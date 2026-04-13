"""
SendGrid email delivery service.

Public surface:
  send_daily_newsletter(subscriber, topics) -> bool
  run_daily_newsletter(db)               -> None   (called by scheduler)
"""

from __future__ import annotations

import html
import logging
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

import sendgrid
from sendgrid.helpers.mail import (
    Content,
    DynamicTemplateData,
    Email,
    Mail,
    Personalization,
    To,
)
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..config import settings
from ..models.article import Article
from ..models.content import ContentItem
from ..models.role import Role
from ..models.subscriber import Subscriber
from ..models.topic import Topic, TopicStatus
from .newsletter_selection import select_articles_for_newsletter_topic
from .pipeline_settings import merge_pipeline_settings, set_last_newsletter_sent_at
from .trend_service import newsletter_topic_velocity_trend

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal client factory (allows easy mocking in tests)
# ---------------------------------------------------------------------------

_sg_client: sendgrid.SendGridAPIClient | None = None


def _get_sg_client() -> sendgrid.SendGridAPIClient:
    global _sg_client
    if _sg_client is None:
        _sg_client = sendgrid.SendGridAPIClient(api_key=settings.sendgrid_api_key)
    return _sg_client


_FF = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

_DOMAIN_COLORS: dict[str, str] = {
    "AI": "#7C3AED",
    "Security": "#E91D24",
    "Cloud": "#0284C7",
    "Finance": "#019E7C",
    "Leadership": "#D97706",
    "Other": "#6B7280",
}

# Stock hero images by radar domain (Unsplash, stable URLs). Email clients may require “load images”.
_DOMAIN_HERO_IMAGES: dict[str, str] = {
    "AI": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80",
    "Security": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
    "Cloud": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    "Finance": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
    "Leadership": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    "Other": "https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=1200&q=80",
}


def _hero_image_url_for_domain(domain: str | None) -> str:
    dom = domain or "Other"
    return _DOMAIN_HERO_IMAGES.get(dom, _DOMAIN_HERO_IMAGES["Other"])


def _posture_badge_colors(topic: Topic) -> tuple[str, str]:
    """Background and text hex colors for adoption / posture (traffic-light style)."""
    a = topic.adoption_state
    if a is None:
        return "#6B7280", "#FFFFFF"
    label = a.value if hasattr(a, "value") else str(a)
    # Maps AdoptionState labels — Learn / Make the Most = greens; Prepared = yellow; Hands around = red; Ahead = amber.
    mapping: dict[str, tuple[str, str]] = {
        "Learn About": ("#019E7C", "#FFFFFF"),
        "Get Ahead Of": ("#D97706", "#FFFFFF"),
        "Get Prepared For": ("#EAB308", "#111827"),
        "Get Your Hands Around": ("#E91D24", "#FFFFFF"),
        "Make the Most Of": ("#059669", "#FFFFFF"),
    }
    return mapping.get(label, ("#6B7280", "#FFFFFF"))


def _radar_explore_url(public_site_base: str, domain: str | None) -> str:
    base = (public_site_base or "http://localhost:3100").rstrip("/")
    dom = domain or "Other"
    return f"{base}/?domain={quote(dom)}"

_TYPE_LABELS: dict[str, str] = {
    "article": "Article",
    "video": "Video",
    "landing_page": "Landing Page",
}


def _format_date_long(d: datetime) -> str:
    """e.g. April 1, 2026 — portable (no %-d)."""
    return d.strftime("%B ") + str(d.day) + d.strftime(", %Y")


def _short_month_day(d: datetime) -> str:
    return d.strftime("%b ") + str(d.day)


def _first_sentences(text: str | None, max_sentences: int = 3) -> str:
    if not text:
        return ""
    t = text.strip()
    if not t:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", t)
    out = " ".join(parts[:max_sentences]).strip()
    return out if out else t[:400]


def _first_sentence(text: str | None) -> str:
    return _first_sentences(text, 1)


def _industry_position_narrative(pos: object) -> str:
    """Merge per-industry grid strings (same precedence as radar / Analysis)."""
    if not isinstance(pos, dict):
        return ""
    primary = (str(pos.get("industry_impact") or pos.get("rationale") or "")).strip()
    scoring = (str(pos.get("scoring_rationale") or "")).strip()
    phase = (str(pos.get("phase_rationale") or "")).strip()
    parts: list[str] = []
    if primary:
        parts.append(primary)
    if scoring and scoring != primary:
        parts.append(scoring)
    if phase and phase not in (primary, scoring):
        parts.append(phase)
    return " ".join(parts)


def _subscriber_industry_teaser(topic: Topic, subscriber: Subscriber | None) -> str:
    if subscriber is None or not isinstance(topic.industry_positions, dict):
        return ""
    for ind in getattr(subscriber, "industries", None) or []:
        pos = topic.industry_positions.get(ind)
        block = _industry_position_narrative(pos)
        if block:
            return _first_sentences(block, 3)
    return ""


NEWSLETTER_BRIEF_KEYS = ("what_is_it", "what_changed", "why_it_matters", "what_to_do")


def _clamp_brief_sentences(text: str | None, max_sentences: int = 3) -> str:
    t = (text or "").strip()
    return _first_sentences(t, max_sentences) if t else ""


def _article_recency_ts(article: Article) -> datetime:
    ia = article.ingested_at
    pa = article.published_at
    if ia is None and pa is None:
        return datetime.min.replace(tzinfo=UTC)
    if pa is None:
        return ia if ia.tzinfo else ia.replace(tzinfo=UTC)
    if ia is None:
        return pa if pa.tzinfo else pa.replace(tzinfo=UTC)
    iau = ia if ia.tzinfo else ia.replace(tzinfo=UTC)
    pau = pa if pa.tzinfo else pa.replace(tzinfo=UTC)
    return max(iau, pau)


def _subscriber_remediation_teaser(topic: Topic, subscriber: Subscriber | None) -> str:
    if subscriber is None or not isinstance(topic.industry_positions, dict):
        return ""
    for ind in getattr(subscriber, "industries", None) or []:
        pos = topic.industry_positions.get(ind)
        if isinstance(pos, dict):
            r = (pos.get("remediation") or "").strip()
            if r:
                return _clamp_brief_sentences(r, 3)
    return ""


def _resolve_newsletter_briefing(
    topic: Topic,
    articles: list[Article],
    subscriber: Subscriber | None,
) -> dict[str, str]:
    raw = getattr(topic, "newsletter_briefing", None)
    stored = {k: "" for k in NEWSLETTER_BRIEF_KEYS}
    if isinstance(raw, dict):
        for k in NEWSLETTER_BRIEF_KEYS:
            stored[k] = _clamp_brief_sentences(str(raw.get(k) or "").strip(), 3)
    by_recency = sorted(articles, key=_article_recency_ts, reverse=True)
    a0 = by_recency[0] if by_recency else None
    a1 = by_recency[1] if len(by_recency) > 1 else None

    out = dict(stored)
    if not out["what_is_it"]:
        if a0 and (a0.what_is_it or "").strip():
            out["what_is_it"] = _clamp_brief_sentences(a0.what_is_it, 3)
        else:
            out["what_is_it"] = _clamp_brief_sentences(topic.summary, 3)
    if not out["what_changed"]:
        if a1:
            cand = (a1.what_is_it or a1.why_it_matters or "").strip()
            if cand and cand != out.get("what_is_it"):
                out["what_changed"] = _clamp_brief_sentences(cand, 3)
        if not out["what_changed"] and a0:
            wi0 = (a0.what_is_it or "").strip()
            t0 = (a0.title or "").strip()
            if wi0 and wi0 != out["what_is_it"]:
                out["what_changed"] = _clamp_brief_sentences(wi0, 3)
            elif t0:
                out["what_changed"] = _clamp_brief_sentences(
                    f"Latest reporting advances this thread — see: {t0}", 2
                )
    if not out["why_it_matters"]:
        if a0 and (a0.why_it_matters or "").strip():
            out["why_it_matters"] = _clamp_brief_sentences(a0.why_it_matters, 3)
        else:
            out["why_it_matters"] = _clamp_brief_sentences(
                _subscriber_industry_teaser(topic, subscriber), 3
            )
    if not out["what_to_do"]:
        out["what_to_do"] = _subscriber_remediation_teaser(topic, subscriber)

    fallbacks = {
        "what_is_it": "This theme remains on your executive radar — see linked sources below.",
        "what_changed": "Today’s briefing draws on the freshest sources attached to this topic.",
        "why_it_matters": "Monitor for operational, risk, and competitive implications for your sector.",
        "what_to_do": "Assign an owner to scan the sources and decide what warrants a pilot or policy update.",
    }
    for k, fb in fallbacks.items():
        if not out[k]:
            out[k] = fb
    return out


def _trend_indicator_html(trend: str) -> str:
    if trend == "up":
        sym, label, bg, fg = "&#8593;", "Rising attention", "#ECFDF5", "#065F46"
    elif trend == "down":
        sym, label, bg, fg = "&#8595;", "Cooling coverage", "#FFFBEB", "#92400E"
    else:
        sym, label, bg, fg = "&#8594;", "Steady coverage", "#F3F4F6", "#374151"
    return f"""<span style="display:inline-block;background:{bg};color:{fg};font-size:10px;
                 font-weight:700;letter-spacing:0.07em;text-transform:uppercase;border-radius:4px;
                 padding:5px 12px;font-family:{_FF};vertical-align:middle;white-space:nowrap;">
      Trending&nbsp;<span style="font-size:13px;font-weight:800;line-height:1;" aria-hidden="true">{sym}</span>
      &nbsp;{html.escape(label)}
    </span>"""


def _briefing_subsection(title: str, body: str) -> str:
    b = (body or "").strip()
    if not b:
        return ""
    return f"""
    <div style="margin:0 0 22px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;font-family:{_FF};">{html.escape(title)}</p>
      <p style="margin:0;font-size:14px;color:#111827;line-height:1.72;font-family:{_FF};">{html.escape(b)}</p>
    </div>"""


def _industry_lens_block(topic: Topic, subscriber: Subscriber | None) -> str:
    if subscriber is None or not isinstance(topic.industry_positions, dict):
        return ""
    lines: list[str] = []
    for ind in getattr(subscriber, "industries", None) or []:
        pos = topic.industry_positions.get(ind)
        blurb = _industry_position_narrative(pos)
        if blurb:
            lines.append(f"{ind}: {_clamp_brief_sentences(blurb, 2)}")
    if not lines:
        return ""
    inner = html.escape(" ".join(lines))
    return f"""
    <div style="margin:4px 0 8px;padding:14px 16px;background:#FAFAFA;border-radius:6px;border:1px solid #E5E7EB;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;font-family:{_FF};">Your industries</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.65;font-family:{_FF};">{inner}</p>
    </div>"""


def _article_teaser_for_email(article: Article) -> str:
    for raw in (article.why_it_matters, article.what_is_it):
        s = (raw or "").strip()
        if s:
            return _first_sentences(s, 3)
    content = (article.content or "").strip()
    if content:
        plain = re.sub(r"<[^>]+>", " ", content)
        plain = re.sub(r"\s+", " ", plain).strip()
        if len(plain) > 40:
            return _first_sentences(plain, 2)
    return ""


def _adoption_label(topic: Topic) -> str:
    a = topic.adoption_state
    if a is None:
        return ""
    return a.value if hasattr(a, "value") else str(a)


def _select_articles_for_topic(
    topic: Topic,
    db: Session,
    role_objs: list,
    *,
    article_ingested_after: datetime | None = None,
) -> list[Article]:
    """
    Pick deep-dive articles for this subscriber's job title(s) using persona-scored ranking.

    Domain/topic filtering happens before the newsletter HTML is built; here we only rank
    within the topic using ``persona_impacts[Role.name]``, recency, and topic urgency.
    """
    names = [(getattr(r, "name", None) or "").strip() for r in role_objs]
    role_names = [n for n in names if n] or None
    return select_articles_for_newsletter_topic(
        topic,
        db,
        role_names,
        article_ingested_after=article_ingested_after,
    )


def _article_why_for_subscriber(article: Article, role_obj: object | None) -> str:
    """Prefer persona-specific impact when persona_impacts and role name match."""
    if role_obj is not None:
        name = getattr(role_obj, "name", None)
        impacts = article.persona_impacts
        if name and isinstance(impacts, dict):
            hit = impacts.get(name)
            if isinstance(hit, str) and hit.strip():
                return hit.strip()
    return (article.why_it_matters or "").strip()


def _persona_text_for_topic(
    topic: Topic,
    articles: list[Article],
    role_objs: list,
) -> str | None:
    if not role_objs:
        return None
    for role_obj in role_objs:
        name = getattr(role_obj, "name", None)
        if not name:
            continue
        pbr = topic.persona_by_role
        if isinstance(pbr, dict):
            v = pbr.get(name)
            if isinstance(v, str) and v.strip():
                return v.strip()
    for role_obj in role_objs:
        for a in articles:
            w = _article_why_for_subscriber(a, role_obj)
            if w:
                return w
    return None


_EMAIL_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:{ff};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;">
  <tr>
    <td align="center" style="padding:24px 16px 40px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#FFFFFF;border-radius:8px;
                    overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

        <!-- 1 Utility header -->
        <tr>
          <td style="background:#FFFFFF;padding:12px 24px;border-bottom:1px solid #E5E7EB;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#4A5F6D;font-size:12px;font-family:{ff};">{date}</td>
                <td align="right">
                  <a href="{read_online_url}" style="color:#019E7C;font-size:12px;font-family:{ff};
                     text-decoration:none;font-weight:600;">Read online &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- 2 Brand banner -->
        <tr>
          <td style="padding:28px 32px 8px;text-align:center;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:0.04em;color:#111827;
                      font-family:{ff};">PULSE<span style="color:#E91D24;">ONE</span></p>
            <p style="margin:0;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;
                      color:#4A5F6D;font-family:{ff};">TECHNOLOGY RADAR BRIEFING</p>
          </td>
        </tr>

        <!-- 3 Greeting -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:#111827;font-family:{ff};">
              Good morning, {first_name}.
            </p>
            <p style="margin:0 0 14px;font-size:14px;color:#4A5F6D;font-family:{ff};line-height:1.65;">
              Here are the top technology signals your team needs to know about{industry_line},
              curated by AI and reviewed by PulseOne analysts.
            </p>
            <p style="margin:0;font-size:13px;font-family:{ff};">
              <a href="{read_online_url}" style="color:#019E7C;text-decoration:none;font-weight:600;">Share this briefing</a>
              <span style="color:#9CA3AF;"> &middot; </span>
              <a href="{read_online_url}" style="color:#019E7C;text-decoration:none;font-weight:600;">Forward to a colleague</a>
            </p>
          </td>
        </tr>

        <!-- 4 Top stories -->
        <tr>
          <td style="padding:0 32px 8px;">
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 12px;">
            <p style="margin:0 0 16px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                      color:#4A5F6D;font-family:{ff};">YOUR RADAR BRIEFING &middot; Top Stories</p>
            {top_stories_html}
          </td>
        </tr>

        <!-- 5 Deep dives -->
        {deep_dives_html}

        <!-- 6 Promo -->
        {promo_html}

        <!-- 7 Quick hits -->
        {quick_hits_html}

        <!-- 8 Tip -->
        {tip_html}

        <!-- 9 Survey -->
        {survey_html}

        <!-- 10 Footer -->
        <tr>
          <td style="background:#F4F8FA;padding:28px 32px;border-top:1px solid #E5E7EB;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#111827;font-family:{ff};">Stay Connected</p>
            <p style="margin:0 0 16px;font-size:12px;font-family:{ff};">
              <a href="https://www.linkedin.com/company/pulseone" style="color:#019E7C;text-decoration:none;">LinkedIn</a>
              <span style="color:#9CA3AF;"> &middot; </span>
              <a href="https://x.com/pulseone" style="color:#019E7C;text-decoration:none;">X</a>
            </p>
            <p style="margin:0 0 12px;font-size:11px;color:#6B7280;line-height:1.6;font-family:{ff};">
              You&rsquo;re receiving this because you subscribed to PulseOne Radar.<br>
              Domains: {domains_label} &middot; Industry: {industry_label} &middot; Role: {role_label}
            </p>
            <p style="margin:0 0 12px;font-size:11px;font-family:{ff};">
              <a href="{read_online_url}" style="color:#019E7C;text-decoration:none;">Manage preferences</a>
              <span style="color:#9CA3AF;"> &middot; </span>
              <a href="{read_online_url}" style="color:#019E7C;text-decoration:none;">Unsubscribe</a>
            </p>
            <p style="margin:0;font-size:11px;color:#6B7280;font-family:{ff};">&copy; 2026 PulseOne &middot; pulseone.com</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
"""


def _build_top_stories_block(
    topics: list[Topic],
    *,
    db: Session | None = None,
    subscriber: Subscriber | None = None,
    role_objs: list | None = None,
    article_ingested_after: datetime | None = None,
) -> str:
    role_names: list[str] | None = None
    if role_objs:
        names = [(getattr(r, "name", None) or "").strip() for r in role_objs]
        role_names = [n for n in names if n] or None
    rows = []
    for t in topics:
        summ = _first_sentences(t.summary, 3).strip()
        if not summ and db is not None:
            for cutoff in (article_ingested_after, None):
                arts = select_articles_for_newsletter_topic(
                    t,
                    db,
                    role_names,
                    article_ingested_after=cutoff,
                    limit=1,
                )
                if arts:
                    summ = _article_teaser_for_email(arts[0])
                    break
        if not summ:
            summ = _subscriber_industry_teaser(t, subscriber)
        if not summ:
            summ = (
                "This theme is on your radar — open the full briefing below for linked sources and context."
            )
        rows.append(
            f'<p style="margin:0 0 12px;font-family:{_FF};">'
            f'<span style="font-size:15px;font-weight:700;color:#111827;">{html.escape(t.name)}</span><br>'
            f'<span style="font-size:13px;color:#4A5F6D;line-height:1.6;">{html.escape(summ)}</span>'
            f"</p>"
        )
    return (
        "\n".join(rows)
        if rows
        else (
            f'<p style="margin:0;font-size:13px;color:#4A5F6D;font-family:{_FF};">No top stories this issue.</p>'
        )
    )


def _build_deep_dive_section(
    topic: Topic,
    articles: list[Article],
    role_objs: list,
    role_display: str,
    subscriber: Subscriber | None = None,
    *,
    db: Session | None = None,
    public_site_url: str = "http://localhost:3100",
) -> str:
    dom = topic.domain or "Other"
    color = _DOMAIN_COLORS.get(dom, "#6B7280")
    posture_label = _adoption_label(topic)
    posture = html.escape(posture_label)
    badge_bg, badge_fg = _posture_badge_colors(topic)
    hero_src = html.escape(_hero_image_url_for_domain(dom))
    explore_href = html.escape(_radar_explore_url(public_site_url, dom))

    persona = _persona_text_for_topic(topic, articles, role_objs)
    persona_html = ""
    if persona:
        persona_html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#F4F8FA;border-left:3px solid {badge_bg};border-radius:4px;">
      <tr>
        <td style="padding:12px 14px;font-family:{_FF};">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#111827;">Where to focus &mdash; for you as a {html.escape(role_display)}:</p>
          <p style="margin:0;font-size:13px;color:#4A5F6D;line-height:1.6;">{html.escape(persona)}</p>
        </td>
      </tr>
    </table>"""

    art_rows = []
    for i, a in enumerate(articles[:3], start=1):
        title = html.escape(a.title or "Read article")
        url = html.escape(a.url or "#")
        art_rows.append(
            f'<tr><td style="padding:4px 0;font-family:{_FF};">'
            f'<span style="color:#9CA3AF;font-size:12px;font-weight:600;">{i}.</span> '
            f'<a href="{url}" style="color:#019E7C;text-decoration:none;font-weight:600;font-size:13px;">{title}</a>'
            f"</td></tr>"
        )
    arts_block = ""
    if art_rows:
        arts_block = f"""
    <p style="margin:18px 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4A5F6D;font-family:{_FF};">
      Top reads (sources)
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
      {"".join(art_rows)}
    </table>"""

    trend = "flat"
    if db is not None:
        try:
            trend = newsletter_topic_velocity_trend(db, topic.id)
        except Exception:
            logger.debug("newsletter trend for topic %s failed", topic.id, exc_info=True)
            trend = "flat"
    trend_html = _trend_indicator_html(trend)

    briefing = _resolve_newsletter_briefing(topic, articles, subscriber)
    briefing_html = (
        _briefing_subsection("What it is (today)", briefing["what_is_it"])
        + _briefing_subsection("What has changed", briefing["what_changed"])
        + _briefing_subsection("Why it matters", briefing["why_it_matters"])
        + _briefing_subsection("What to do about it", briefing["what_to_do"])
    )
    industry_lens = _industry_lens_block(topic, subscriber)

    dig_deeper = f"""
    <p style="margin:18px 0 6px;font-family:{_FF};">
      <a href="{explore_href}" style="color:#019E7C;text-decoration:none;font-weight:700;font-size:14px;">
        Dig deeper on the PulseOne Radar &rarr;
      </a>
    </p>
    <p style="margin:0 0 0;font-size:12px;color:#6B7280;line-height:1.5;font-family:{_FF};">
      Open the live radar filtered to <strong style="color:#4A5F6D;">{html.escape(dom)}</strong> for charts, tracked stories, and more context.
    </p>"""

    return f"""
<tr>
  <td style="padding:24px 32px 0;">
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 18px;">
    <p style="margin:0 0 6px;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;
              color:{color};font-family:{_FF};">{html.escape(dom.upper())}</p>
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;font-family:{_FF};line-height:1.25;">{html.escape(topic.name)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:0;line-height:0;background:#E5E7EB;">
          <img src="{hero_src}" width="560" alt="{html.escape(topic.name)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;" />
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-family:{_FF};">
      <tr>
        <td style="padding:0 10px 0 0;vertical-align:middle;width:1%;white-space:nowrap;">
          <span style="display:inline-block;vertical-align:middle;background:{badge_bg};color:{badge_fg};font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-radius:4px;padding:4px 10px;">
            YOUR POSTURE: {posture}
          </span>
        </td>
        <td style="padding:0;vertical-align:middle;">
          {trend_html}
        </td>
      </tr>
    </table>
    <div style="margin:6px 0 4px;">
    {briefing_html}
    </div>
    {industry_lens}
    {persona_html}
    {arts_block}
    {dig_deeper}
  </td>
</tr>
"""


def _build_quick_hits_block(topics: list[Topic]) -> str:
    if not topics:
        return ""
    items = []
    for t in topics:
        sent = _first_sentence(t.summary).strip()
        if not sent:
            sent = "Follow this theme on your radar for linked sources and updates."
        line = f"{t.name}: {sent}"
        items.append(
            f'<p style="margin:0 0 8px;font-size:13px;color:#111827;font-family:{_FF};line-height:1.5;">'
            f"{html.escape(line)}</p>"
        )
    inner = "\n".join(items)
    return f"""
<tr>
  <td style="padding:24px 32px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
              color:#4A5F6D;font-family:{_FF};">ALSO ON OUR RADAR</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8FA;border-radius:8px;">
      <tr><td style="padding:16px 18px;">{inner}</td></tr>
    </table>
  </td>
</tr>
"""


def _build_promo_section(items: list[ContentItem]) -> str:
    if not items:
        return ""
    blocks = []
    for item in items[:3]:
        tlabel = _TYPE_LABELS.get(item.type, item.type.replace("_", " ").title())
        img_html = ""
        if getattr(item, "image_url", None):
            img_html = (
                f'<p style="margin:0 0 10px;">'
                f'<img src="{html.escape(item.image_url)}" width="560" alt="" '
                f'style="display:block;max-width:100%;height:auto;border-radius:6px;border:0;"></p>'
            )
        summ = (
            f'<p style="margin:8px 0 0;font-size:13px;color:#4A5F6D;line-height:1.6;font-family:{_FF};">'
            f"{html.escape(item.summary)}</p>"
            if item.summary
            else ""
        )
        blocks.append(
            f"""
    <tr>
      <td style="padding:0 0 20px 0;">
        {img_html}
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#FEE2E2;
                     font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;
                     color:#E91D24;font-family:{_FF};">{html.escape(tlabel)}</span>
        <p style="margin:8px 0 0;font-family:{_FF};">
          <a href="{html.escape(item.url)}" style="font-size:15px;font-weight:700;color:#111827;text-decoration:none;line-height:1.35;">
            {html.escape(item.title)}
          </a>
        </p>
        {summ}
      </td>
    </tr>"""
        )
    body = "\n".join(blocks)
    return f"""
<tr>
  <td style="padding:8px 32px 8px;">
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 14px;">
    <p style="margin:0 0 16px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
              color:#E91D24;font-family:{_FF};">FROM PULSEONE &middot; Recommended Resources</p>
    <table width="100%" cellpadding="0" cellspacing="0">{body}</table>
  </td>
</tr>
"""


def _build_tip_block(top_topic_name: str) -> str:
    top = html.escape(top_topic_name or "your top radar themes")
    return f"""
<tr>
  <td style="padding:8px 32px 8px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
              color:#019E7C;font-family:{_FF};">PULSEONE TIP OF THE WEEK</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8FA;border-left:3px solid #019E7C;border-radius:6px;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;color:#111827;line-height:1.6;font-family:{_FF};">
          Is your organization prepared for {top}? Take our free 5-minute readiness assessment
          &rarr; <a href="https://pulseone.com" style="color:#019E7C;font-weight:600;text-decoration:none;">Get started</a>
        </td>
      </tr>
    </table>
  </td>
</tr>
"""


def _build_survey_block(base_url: str, email: str, newsletter_date: str) -> str:
    qe = quote(email, safe="")
    b = base_url.rstrip("/")
    u3 = f"{b}/api/survey?email={qe}&score=3&date={quote(newsletter_date)}"
    u2 = f"{b}/api/survey?email={qe}&score=2&date={quote(newsletter_date)}"
    u1 = f"{b}/api/survey?email={qe}&score=1&date={quote(newsletter_date)}"
    return f"""
<tr>
  <td style="padding:24px 32px 16px;">
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 20px;">
    <p style="margin:0 0 8px;text-align:center;font-size:16px;font-weight:700;color:#111827;font-family:{_FF};">
      Before you go &mdash; how relevant was today&rsquo;s briefing?
    </p>
    <p style="margin:0 0 18px;text-align:center;font-size:13px;color:#4A5F6D;font-family:{_FF};">
      Your feedback helps us personalize future issues.
    </p>
    <table align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="padding:4px;">
          <a href="{u3}" style="display:inline-block;background:#019E7C;color:#FFFFFF;text-decoration:none;
             font-size:13px;font-weight:600;font-family:{_FF};border-radius:6px;padding:10px 20px;">Highly Relevant</a>
        </td>
        <td style="padding:4px;">
          <a href="{u2}" style="display:inline-block;background:#F4F8FA;color:#111827;text-decoration:none;
             font-size:13px;font-weight:600;font-family:{_FF};border-radius:6px;padding:10px 20px;border:1px solid #E5E7EB;">Somewhat Relevant</a>
        </td>
        <td style="padding:4px;">
          <a href="{u1}" style="display:inline-block;background:#F4F8FA;color:#111827;text-decoration:none;
             font-size:13px;font-weight:600;font-family:{_FF};border-radius:6px;padding:10px 20px;border:1px solid #E5E7EB;">Not Relevant</a>
        </td>
      </tr>
    </table>
    <p style="margin:22px 0 0;text-align:center;font-size:14px;color:#4A5F6D;font-family:{_FF};">
      Thanks for reading. &mdash; The PulseOne Team
    </p>
  </td>
</tr>
"""


def _build_html(
    subscriber: Subscriber,
    topics: list[Topic],
    db: Session | None = None,
    promoted_content: list[ContentItem] | None = None,
    article_ingested_after: datetime | None = None,
) -> str:
    role_objs = _resolve_subscriber_roles(subscriber, db)
    role_footer = ", ".join(
        (getattr(r, "name", None) or "").strip()
        for r in role_objs
        if (getattr(r, "name", None) or "").strip()
    )
    role_display = role_footer or "Leader"
    public_site = (settings.public_site_url or "http://localhost:3100").rstrip("/")

    sorted_topics = sorted(topics, key=lambda t: t.urgency_score, reverse=True)
    top_stories = sorted_topics[:3]
    deep_dives = sorted_topics[3:7]
    quick_hits = sorted_topics[7:]

    top_stories_html = _build_top_stories_block(
        top_stories,
        db=db,
        subscriber=subscriber,
        role_objs=role_objs,
        article_ingested_after=article_ingested_after,
    )

    deep_parts = []
    if db is not None:
        for topic in deep_dives:
            arts = _select_articles_for_topic(
                topic, db, role_objs, article_ingested_after=article_ingested_after
            )
            if not arts and article_ingested_after is not None:
                arts = _select_articles_for_topic(
                    topic, db, role_objs, article_ingested_after=None
                )
            deep_parts.append(
                _build_deep_dive_section(
                    topic,
                    arts,
                    role_objs,
                    role_display,
                    subscriber=subscriber,
                    db=db,
                    public_site_url=public_site,
                )
            )
    else:
        for topic in deep_dives:
            deep_parts.append(
                _build_deep_dive_section(
                    topic,
                    [],
                    role_objs,
                    role_display,
                    subscriber=subscriber,
                    db=None,
                    public_site_url=public_site,
                )
            )
    deep_dives_html = "\n".join(deep_parts)

    quick_hits_html = _build_quick_hits_block(quick_hits)

    promo_html = ""
    if promoted_content:
        promo_html = _build_promo_section(promoted_content)

    tip_name = (
        top_stories[0].name
        if top_stories
        else (sorted_topics[0].name if sorted_topics else "AI adoption")
    )
    tip_html = _build_tip_block(tip_name)

    now = datetime.now(UTC)
    newsletter_date = now.strftime("%Y-%m-%d")
    base_url = (settings.api_base_url or "http://localhost:8000").rstrip("/")
    read_online = base_url + "/"
    survey_html = _build_survey_block(base_url, subscriber.email, newsletter_date)

    inds = getattr(subscriber, "industries", None) or []
    if len(inds) == 1:
        industry_line = f" for the {inds[0]} sector"
    elif len(inds) > 1:
        industry_line = f" for the {', '.join(inds)} sectors"
    else:
        industry_line = ""

    return _EMAIL_TEMPLATE.format(
        ff=_FF,
        date=html.escape(_format_date_long(now)),
        read_online_url=read_online,
        first_name=html.escape(subscriber.first_name or "there"),
        industry_line=html.escape(industry_line) if industry_line else "",
        top_stories_html=top_stories_html,
        deep_dives_html=deep_dives_html,
        promo_html=promo_html,
        quick_hits_html=quick_hits_html,
        tip_html=tip_html,
        survey_html=survey_html,
        domains_label=html.escape(", ".join(subscriber.domains or []) or "All"),
        industry_label=html.escape(", ".join(inds) or "Not specified"),
        role_label=html.escape(role_footer or "Not specified"),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def send_daily_newsletter(
    subscriber: Subscriber,
    topics: list[Topic],
    db: Session | None = None,
    promoted_content: list[ContentItem] | None = None,
    article_ingested_after: datetime | None = None,
) -> bool:
    """
    Send a personalized newsletter to one subscriber.

    Uses a SendGrid dynamic template if SENDGRID_NEWSLETTER_TEMPLATE_ID is set,
    otherwise falls back to the built-in HTML template.

    Returns True if accepted by SendGrid (HTTP 202), False otherwise.
    """
    sg = _get_sg_client()
    roles = _resolve_subscriber_roles(subscriber, db)

    from_email = Email(
        email=settings.sendgrid_from_email,
        name=settings.sendgrid_from_name,
    )
    role_bit = ""
    if roles:
        names = ", ".join((r.name or "").strip() for r in roles if (r.name or "").strip())
        if names:
            role_bit = f" · {names}"
    subject = (
        f"PulseOne Radar{role_bit}: {len(topics)} signal{'s' if len(topics) != 1 else ''} "
        f"this week — {_short_month_day(datetime.now(UTC))}"
    )

    if settings.sendgrid_newsletter_template_id:
        message = Mail(from_email=from_email)
        message.template_id = settings.sendgrid_newsletter_template_id
        p = Personalization()
        p.add_to(To(email=subscriber.email))
        merged_tags: list[str] = []
        seen_tag: set[str] = set()
        for r in roles:
            for t in r.tags or []:
                s = str(t).strip()
                if s and s.lower() not in seen_tag:
                    seen_tag.add(s.lower())
                    merged_tags.append(s)
        industry_str = ", ".join(subscriber.industries or []) if subscriber.industries else ""
        role_names_list = [r.name for r in roles if r.name]
        p.dynamic_template_data = DynamicTemplateData(
            {
                "first_name": subscriber.first_name,
                "last_name": subscriber.last_name,
                "industry": industry_str,
                "domains": subscriber.domains or [],
                "role_name": ", ".join(role_names_list) or "",
                "role_names": role_names_list,
                "role_tags": merged_tags,
                "topics": [
                    {
                        "name": t.name,
                        "domain": t.domain,
                        "urgency_score": t.urgency_score,
                        "summary": t.summary or "",
                        "newsletter_briefing": getattr(t, "newsletter_briefing", None) or {},
                    }
                    for t in topics
                ],
            }
        )
        message.add_personalization(p)
    else:
        html_body = _build_html(
            subscriber,
            topics,
            db=db,
            promoted_content=promoted_content,
            article_ingested_after=article_ingested_after,
        )
        message = Mail(
            from_email=from_email,
            to_emails=To(email=subscriber.email),
            subject=subject,
            html_content=Content("text/html", html_body),
        )

    try:
        response = sg.send(message)
        accepted = response.status_code == 202
        if accepted:
            logger.info("Newsletter sent to %s (%d topics)", subscriber.email, len(topics))
        else:
            logger.warning(
                "Unexpected SendGrid status %d for %s",
                response.status_code,
                subscriber.email,
            )
        return accepted
    except Exception:
        logger.exception("SendGrid error for subscriber %s", subscriber.email)
        return False


def _resolve_subscriber_roles(subscriber: Subscriber, db: Session | None) -> list[Role]:
    """Resolve Role rows for this subscriber (order preserved when loading by role_ids)."""
    explicit = getattr(subscriber, "roles", None)
    if explicit is not None:
        return list(explicit)
    single = getattr(subscriber, "role", None)
    if single is not None:
        return [single]
    rids = getattr(subscriber, "role_ids", None) or []
    if not rids or db is None:
        return []
    rows = db.query(Role).filter(Role.id.in_(rids)).all()
    id_to_r = {r.id: r for r in rows}
    return [id_to_r[i] for i in rids if i in id_to_r]


def _resolve_subscriber_role(subscriber: Subscriber, db: Session | None) -> Role | None:
    roles = _resolve_subscriber_roles(subscriber, db)
    return roles[0] if roles else None


def _domain_allow_for_newsletter(subscriber: Subscriber, roles: list[Role] | None) -> set[str] | None:
    """
    Which topic domains to include for this subscriber.

    Explicit `subscriber.domains` (from the subscribe wizard) wins. If the subscriber
    left domains empty, fall back to their job titles' `Role.tags` (unioned; same vocabulary as
    topic.domain: AI, Security, etc.). If neither applies, return None (all eligible topics).
    """
    domains = getattr(subscriber, "domains", None)
    if domains:
        return {d for d in domains if d}
    if roles:
        tags: list[str] = []
        for role in roles:
            if role and getattr(role, "tags", None):
                tags.extend(str(t).strip() for t in role.tags if t and str(t).strip())
        if tags:
            return set(tags)
    return None


def assemble_promoted_content(
    subscriber: Subscriber,
    db: Session,
) -> list[ContentItem]:
    """
    Return up to 3 active ContentItems matched to the subscriber's role tags.
    Falls back to the 3 most-recently-created active items if no role tags exist.
    """
    all_active: list[ContentItem] = (
        db.query(ContentItem)
        .filter(ContentItem.is_active == True)  # noqa: E712
        .order_by(ContentItem.created_at.desc())
        .all()
    )
    if not all_active:
        return []

    role_objs = _resolve_subscriber_roles(subscriber, db)
    role_tags: set[str] | None = None
    for role_obj in role_objs:
        if role_obj and getattr(role_obj, "tags", None):
            if role_tags is None:
                role_tags = set()
            role_tags |= {t.lower() for t in role_obj.tags}

    if role_tags:
        matched = [
            item for item in all_active if {t.lower() for t in (item.tags or [])} & role_tags
        ]
        return matched[:3]

    return all_active[:3]


def assemble_newsletter_topics(
    subscriber: Subscriber,
    all_approved: list[Topic],
    db: Session | None = None,
    *,
    skip_domain_filter: bool = False,
) -> list[Topic]:
    """
    Filter approved topics to the subscriber's domain interests.

    - If the subscriber chose specific domains in the wizard, only those topic domains
      are included (exact match on ``topic.domain``).
    - If they left domains empty but have a job title (Role) with ``tags``, those tags
      are treated as domain filters (case-insensitive match to ``topic.domain``).
    - If neither applies, all approved topics are returned.

    ``skip_domain_filter=True`` (admin newsletter preview only): ignore domain / role-tag
    narrowing so the sandbox shows the full eligible topic pool while still using roles
    for persona scoring in article picks.

    Topics are sorted by descending urgency score.
    """
    if skip_domain_filter:
        return sorted(all_approved, key=lambda t: t.urgency_score, reverse=True)

    roles = _resolve_subscriber_roles(subscriber, db)
    allow = _domain_allow_for_newsletter(subscriber, roles)

    if allow is None:
        return sorted(all_approved, key=lambda t: t.urgency_score, reverse=True)

    if getattr(subscriber, "domains", None):
        matched = [t for t in all_approved if t.domain in allow]
    else:
        allow_l = {x.lower() for x in allow}
        matched = [t for t in all_approved if (t.domain or "").lower() in allow_l]

    return sorted(matched, key=lambda t: t.urgency_score, reverse=True)


def generate_newsletter_preview(
    db: Session,
    industries: list[str] | None = None,
    domains: list[str] | None = None,
    role_ids: list[int] | None = None,
) -> str:
    """
    Build and return a rendered HTML newsletter for a simulated subscriber.

    Uses up to 20 topics from the **on-radar pipeline** (watched/selected) **or** topics
    **published** to the live Radar, so the preview matches content that exists in the
    product even when pipeline status has not been advanced.

    When **no domain filters** are passed, topic filtering by domain / role tags is skipped
    so the preview shows the full eligible pool (roles still drive persona lines in deep dives).
    """
    role_objs: list[Role] = []
    if role_ids:
        role_objs = db.query(Role).filter(Role.id.in_(role_ids)).all()
        order = {rid: i for i, rid in enumerate(role_ids)}
        role_objs.sort(key=lambda r: order.get(r.id, 999))

    domain_list = list(domains) if domains else []
    skip_domain_topic_filter = len(domain_list) == 0

    dummy = Subscriber(
        id=-1,
        email="preview@pulseone.internal",
        first_name="Jane",
        last_name="Executive",
        industries=industries if industries else ["Technology"],
        domains=domain_list if domain_list else None,
        role_ids=role_ids if role_ids else None,
        is_active=True,
    )
    if role_objs:
        dummy.roles = role_objs  # type: ignore[attr-defined]

    eligible: list[Topic] = (
        db.query(Topic)
        .filter(
            or_(
                Topic.status.in_([TopicStatus.watched, TopicStatus.selected]),
                Topic.is_published == True,  # noqa: E712
            )
        )
        .order_by(Topic.urgency_score.desc())
        .all()
    )

    topics = assemble_newsletter_topics(
        dummy,
        eligible,
        db,
        skip_domain_filter=skip_domain_topic_filter,
    )[:20]

    if not topics:
        no_match = (
            f" matching your domain picks ({', '.join(domain_list)})" if domain_list else ""
        )
        return (
            "<!DOCTYPE html><html><body style='background:#F3F4F6;"
            "color:#374151;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:40px;'>"
            f"<h2 style='color:#111827;'>No topics available for preview{no_match}.</h2>"
            "<p>Promote topics in Research (watched/selected), publish topics to the live Radar, "
            "or clear domain filters.</p>"
            "</body></html>"
        )

    merged = merge_pipeline_settings(db)
    article_cutoff = datetime.now(UTC) - timedelta(days=merged.newsletter_article_lookback_days)
    promoted = assemble_promoted_content(dummy, db)
    return _build_html(
        dummy,
        topics,
        db=db,
        promoted_content=promoted,
        article_ingested_after=article_cutoff,
    )


def run_daily_newsletter(db: Session) -> None:
    """
    Fetch all active subscribers and dispatch newsletters for watched/selected (on-radar) topics.
    Article snippets use newsletter_article_lookback_days and exclude archived rows.
    """
    merged = merge_pipeline_settings(db)
    if not merged.newsletter_enabled:
        logger.info("Daily newsletter: disabled (newsletter_enabled=false)")
        return
    if not settings.sendgrid_api_key:
        logger.warning("Daily newsletter: SENDGRID_API_KEY not set — skipping send")
        return

    article_cutoff = datetime.now(UTC) - timedelta(days=merged.newsletter_article_lookback_days)

    eligible_topics: list[Topic] = (
        db.query(Topic).filter(Topic.status.in_([TopicStatus.watched, TopicStatus.selected])).all()
    )

    if not eligible_topics:
        logger.info("Daily newsletter: no watched/selected topics")
        return

    subscribers: list[Subscriber] = (
        db.query(Subscriber).filter(Subscriber.is_active == True).all()  # noqa: E712
    )

    logger.info(
        "Daily newsletter: %d topics, %d subscribers (article lookback from %s)",
        len(eligible_topics),
        len(subscribers),
        article_cutoff.isoformat(),
    )

    sent = 0
    for subscriber in subscribers:
        matched = assemble_newsletter_topics(subscriber, eligible_topics, db)
        if matched:
            promoted = assemble_promoted_content(subscriber, db)
            if send_daily_newsletter(
                subscriber,
                matched,
                db=db,
                promoted_content=promoted,
                article_ingested_after=article_cutoff,
            ):
                sent += 1

    if sent > 0:
        set_last_newsletter_sent_at(db)

    logger.info("Daily newsletter: %d emails dispatched", sent)
