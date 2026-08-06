"""
SendGrid email delivery service.

Newsletters are always the built-in full HTML briefing (not SendGrid dynamic templates).

Public surface:
  send_daily_newsletter(subscriber, topics) -> tuple[bool, str | None]
  run_daily_newsletter(db)               -> None   (called by scheduler)
  send_test_newsletter(db, to_email)     -> (bool, str)  (admin one-off QA)
"""

from __future__ import annotations

import html
import json
import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import sendgrid
from sendgrid.helpers.mail import Content, Email, Mail, ReplyTo, Subject, To
from sqlalchemy.orm import Session

from ..config import settings
from ..models.article import Article
from ..models.content import ContentItem
from ..models.newsletter_issue import NewsletterIssue
from ..models.role import Role
from ..models.subscriber import Subscriber
from ..models.topic import Topic, TopicStatus
from .newsletter_selection import (
    article_has_persona_for_roles,
    article_industry_bonus,
    select_articles_for_newsletter_topic,
    sort_topics_for_newsletter_profile,
)
from .pipeline_settings import (
    MergedPipelineSettings,
    merge_pipeline_settings,
    set_last_newsletter_sent_at,
)
from .subscriber_tokens import create_subscriber_preferences_token
from .topic_serializers import topic_domain_short, topic_domain_slug_for_filter
from .trend_service import build_hot_of_day, newsletter_topic_velocity_trend

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NewsletterArticleIngestCutoffs:
    """Lower bounds on ``Article.ingested_at`` — newer ingests qualify."""

    #: Profile topic sort peak signal + top rollup first attempt (breaking / daily freshness).
    top_rank_peak: datetime
    #: Deep-dive supporting articles primary pool (still short-horizon for daily brief).
    deep_dive_primary: datetime
    #: Wider fallback when tighter pools yield no usable article rows for that topic.
    legacy_fallback: datetime


def newsletter_article_ingest_cutoffs(
    merged: MergedPipelineSettings,
    *,
    now: datetime | None = None,
) -> NewsletterArticleIngestCutoffs:
    """Derive ingest cutoffs from merged pipeline settings (hours for top/deep; days widen last)."""
    ts = now or datetime.now(UTC)
    return NewsletterArticleIngestCutoffs(
        top_rank_peak=ts - timedelta(hours=merged.newsletter_top_ingest_hours),
        deep_dive_primary=ts - timedelta(hours=merged.newsletter_deep_dive_ingest_hours),
        legacy_fallback=ts - timedelta(days=merged.newsletter_article_lookback_days),
    )


def _newsletter_article_pick_cutoffs(c: NewsletterArticleIngestCutoffs) -> list[datetime | None]:
    ordered: tuple[datetime | None, ...] = (
        c.top_rank_peak,
        c.deep_dive_primary,
        c.legacy_fallback,
        None,
    )
    seen: set[str | None] = set()
    out: list[datetime | None] = []
    for x in ordered:
        sig = "__none__" if x is None else x.isoformat()
        if sig in seen:
            continue
        seen.add(sig)
        out.append(x)
    return out


# Prefer this many radar themes before widening the topic pool beyond strict profile/article fit.
NEWSLETTER_ASSEMBLY_MIN_TOPICS = 5


def _format_sendgrid_error(exc: BaseException) -> str:
    """Pull a short, human-readable message from python_http_client / SendGrid errors."""
    body = getattr(exc, "body", None)
    if body is None:
        return (str(exc) or type(exc).__name__)[:800]
    if isinstance(body, bytes):
        body = body.decode("utf-8", errors="replace")
    if isinstance(body, str) and body.strip():
        try:
            data = json.loads(body)
            errs = data.get("errors")
            if isinstance(errs, list) and errs:
                parts: list[str] = []
                for e in errs:
                    if isinstance(e, dict):
                        m = e.get("message") or e.get("field")
                        if m:
                            parts.append(str(m))
                    else:
                        parts.append(str(e))
                if parts:
                    return "; ".join(parts)[:800]
        except (json.JSONDecodeError, TypeError):
            pass
        return body.strip()[:800]
    return (str(exc) or type(exc).__name__)[:800]


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


def _topic_domain_color(topic: Topic | object) -> str:
    d = getattr(topic, "domain", None)
    if d is not None and not isinstance(d, str):
        color = getattr(d, "color", None)
        if color:
            return str(color)
    return _DOMAIN_COLORS.get(topic_domain_short(topic), "#6B7280")


def _hero_image_url_for_domain(domain: str | None, topic: Topic | None = None) -> str:
    if topic and topic.domain and topic.domain.hero_image_url:
        return topic.domain.hero_image_url
    dom = domain or "Other"
    return _DOMAIN_HERO_IMAGES.get(dom, _DOMAIN_HERO_IMAGES["Other"])


def _newsletter_image_url_for_article(article: Article | None, domain: str | None) -> str:
    """Prefer RSS/source image on the article; fall back to domain stock hero."""
    if article is not None:
        u = getattr(article, "image_url", None)
        if isinstance(u, str) and u.strip():
            return u.strip()
    return _hero_image_url_for_domain(domain, topic=None)


def _newsletter_social_urls(briefing_page_url: str) -> dict[str, str]:
    """Share / forward targets for the public radar page (not the API host)."""
    page = briefing_page_url.rstrip("/") + "/"
    enc_page = quote(page, safe="")
    subj = quote("Pulse of Technology Daily", safe="")
    body = quote(
        f"I thought you might find this Pulse of Technology briefing useful:\n{page}\n",
        safe="",
    )
    return {
        "forward_mailto": f"mailto:?subject={subj}&body={body}",
        "share_x": (
            "https://twitter.com/intent/tweet?"
            f"url={enc_page}&text={quote('Pulse of Technology Daily — executive tech briefing', safe='')}"
        ),
        "share_linkedin": f"https://www.linkedin.com/sharing/share-offsite/?url={enc_page}",
    }


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
    return f"{base}/radar?domain={quote(dom)}#radar"


_TYPE_LABELS: dict[str, str] = {
    "article": "Article",
    "video": "Video",
    "landing_page": "Landing Page",
}


def _format_date_long(d: datetime) -> str:
    """e.g. April 1, 2026 — portable (no %-d)."""
    return d.strftime("%B ") + str(d.day) + d.strftime(", %Y")


def _format_dt_for_email_hot(value: datetime | str | None) -> str:
    """Short line for newsletter hot-article ingest time (matches admin-style readability)."""
    if value is None:
        return ""
    if isinstance(value, str):
        try:
            d = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    else:
        d = value
    if d.tzinfo is None:
        d = d.replace(tzinfo=UTC)
    else:
        d = d.astimezone(UTC)
    return d.strftime("%m/%d/%Y, %I:%M:%S %p")


def _short_month_day(d: datetime) -> str:
    return d.strftime("%b ") + str(d.day)


def _truncate_email_subject(text: str, max_len: int = 140) -> str:
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    if max_len <= 1:
        return "…"
    return text[: max_len - 1].rstrip() + "…"


def _newsletter_logo_url() -> str:
    """Absolute logo URL for SendGrid dynamic templates. Prefer NEWSLETTER_LOGO_URL when set."""
    o = (settings.newsletter_logo_url or "").strip()
    if o:
        return o
    base = (settings.public_site_url or "http://localhost:3100").rstrip("/")
    return f"{base}/pots_logo_new.png"


def _newsletter_issue_url(token: str) -> str:
    base = (settings.api_base_url or "http://localhost:8000").rstrip("/")
    return f"{base}/api/newsletter/issues/{quote(token, safe='')}"


def _newsletter_subject_and_headline(
    topics: list[Topic],
    roles: list[Role],
    hot_data: dict[str, Any] | None,
) -> tuple[str, str | None]:
    """
    Prefer the global hot-topic article title when ``hot_data`` is available; otherwise a
    Pulse of Technology Daily digest line. Returns (subject, headline_for_body or None).

    Hot-topic selection is editorial and shared across subscribers; it no longer depends on
    whether the theme appears in the subscriber's domain-filtered topic list.
    """
    ht, ha, _ = _resolve_hot_topic_lead_for_subscriber(topics, hot_data)
    role_bit = ""
    if roles:
        names = ", ".join((r.name or "").strip() for r in roles if (r.name or "").strip())
        if names:
            role_bit = f" · {names}"
    headline: str | None = None
    if isinstance(ha, dict):
        raw = (ha.get("title") or "").strip()
        if raw:
            headline = raw
            sub = _truncate_email_subject(f"{raw} — Pulse of Technology Daily", 140)
            return sub, headline
    sub = (
        f"Pulse of Technology Daily{role_bit}: {len(topics)} signal{'s' if len(topics) != 1 else ''} "
        f"this week — {_short_month_day(datetime.now(UTC))}"
    )
    return sub, None


def _build_newsletter_header_banner_html(*, headline_article_title: str | None) -> str:
    """
    Light surface header (DESIGN.md). Renders the official hosted logo image with text fallback.
    Logo links to the main PulseOne marketing site.
    """
    logo_src = html.escape(_newsletter_logo_url())
    logo_href = html.escape("https://pulseone.com")
    img_block = f"""
    <p style="margin:0 0 14px;">
      <a href="{logo_href}" style="text-decoration:none;border:0;display:inline-block;" target="_blank" rel="noopener noreferrer">
        <img src="{logo_src}" alt="PulseOne | People | Technology | Progress" width="386" height="83"
             style="display:block;margin:0 auto;max-width:260px;width:100%;height:auto;border:0;" />
      </a>
    </p>"""
    headline_block = ""
    if headline_article_title and headline_article_title.strip():
        t = html.escape(headline_article_title.strip())
        headline_block = f"""
    <p style="margin:18px 0 0;font-size:19px;font-weight:700;line-height:1.35;color:#111827;font-family:{_FF};">
      {t}
    </p>"""
    return f"""
<tr>
  <td style="background:#F4F8FA;padding:28px 32px 24px;text-align:center;border-bottom:1px solid #E5E7EB;">
    {img_block}
    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;
              color:#4A5F6D;font-family:{_FF};">Pulse of Technology Daily</p>
    {headline_block}
  </td>
</tr>
"""


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


def _contextual_what_to_do_fallback(topic: Topic) -> str:
    domain = topic_domain_short(topic)
    name = (getattr(topic, "name", "") or "this topic").strip()
    urgency = float(getattr(topic, "urgency_score", 0.0) or 0.0)
    posture_raw = getattr(topic, "adoption_state", None)
    posture = posture_raw.value if hasattr(posture_raw, "value") else str(posture_raw or "")
    cadence = "this week" if urgency >= 8 else "in the next planning cycle"

    by_domain = {
        "AI": (
            f"Pick one workflow touched by {name} and decide whether it belongs in a pilot, policy review, "
            f"or vendor watchlist {cadence}."
        ),
        "Security": (
            f"Have security and IT owners compare current controls against {name}, then decide what needs "
            f"patching, monitoring, or executive escalation {cadence}."
        ),
        "Cloud": (
            f"Ask platform and finance owners where {name} could affect architecture, cost, or reliability, "
            f"then turn the answer into one concrete backlog item {cadence}."
        ),
        "Compliance": (
            f"Ask legal, compliance, and product owners whether {name} changes obligations, disclosures, "
            f"or control evidence {cadence}."
        ),
        "Storage": (
            f"Have infrastructure and data owners review whether {name} affects backup, retention, "
            f"or recovery posture {cadence}."
        ),
        "Infrastructure": (
            f"Have platform and operations owners map where {name} could affect networking, servers, "
            f"or system dependencies {cadence}."
        ),
    }
    action = by_domain.get(
        domain,
        f"Name the business owner for {name}, identify the decision it may force, and set a follow-up {cadence}.",
    )
    if "Get Your Hands Around" in posture or "Get Prepared For" in posture:
        return _clamp_brief_sentences(
            f"{action} Treat it as a readiness check, not just background reading.",
            2,
        )
    if "Make the Most" in posture or "Get Ahead" in posture:
        return _clamp_brief_sentences(
            f"{action} Look for one advantage you can capture before peers normalize it.",
            2,
        )
    return _clamp_brief_sentences(action, 2)


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
    if not out["what_to_do"]:
        out["what_to_do"] = _contextual_what_to_do_fallback(topic)

    fallbacks = {
        "what_is_it": "This theme remains on your executive radar — see linked sources below.",
        "what_changed": "Today’s briefing draws on the freshest sources attached to this topic.",
        "why_it_matters": "Monitor for operational, risk, and competitive implications for your sector.",
        "what_to_do": "Name an owner, identify the decision this topic may force, and set a near-term follow-up.",
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
    """
    Short explanatory blurb from the article analysis — prefer what's-it-about wording
    (`what_is_it`) over impact framing (`why_it_matters`).
    """
    for raw in (article.what_is_it, article.why_it_matters):
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

        <!-- 2 Header: PulseOne logo + Pulse of Technology Daily + optional hot-article title -->
        {header_banner_html}

        <!-- 3 Greeting -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:#111827;font-family:{ff};">
              Good morning, {first_name}.
            </p>
            <p style="margin:0 0 14px;font-size:14px;color:#4A5F6D;font-family:{ff};line-height:1.65;">
              Here are the top technology signals your team needs to know about{industry_line}.
            </p>
            <p style="margin:0;font-size:13px;font-family:{ff};line-height:1.65;">
              <span style="color:#4A5F6D;">Share:</span>
              <a href="{share_x_url}" style="color:#019E7C;text-decoration:none;font-weight:600;">X</a>
              <span style="color:#9CA3AF;"> &middot; </span>
              <a href="{share_linkedin_url}" style="color:#019E7C;text-decoration:none;font-weight:600;">LinkedIn</a>
              <span style="color:#9CA3AF;"> &middot; </span>
              <a href="{forward_mailto_url}" style="color:#019E7C;text-decoration:none;font-weight:600;">Forward by email</a>
            </p>
          </td>
        </tr>

        {hot_lead_html}

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
              You&rsquo;re receiving this because you subscribed to Pulse of Technology Daily.<br>
              Domains: {domains_label} &middot; Industry: {industry_label} &middot; Role: {role_label}
            </p>
            <p style="margin:0 0 12px;font-size:11px;font-family:{ff};">
              <a href="{manage_preferences_url}" style="color:#019E7C;text-decoration:none;">Manage preferences</a>
              <span style="color:#9CA3AF;"> &middot; </span>
              <a href="{unsubscribe_url}" style="color:#019E7C;text-decoration:none;">Unsubscribe</a>
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


def _resolve_hot_topic_lead_for_subscriber(
    topics: list[Topic],
    hot_data: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, int | None]:
    """
    Return the global ``hot_of_day`` lead for everyone when ``hot_topic`` / ``hot_article`` exist.

    ``topics`` is retained for call-site compatibility only; the lead is **not** gated on
    whether the subscriber's domain-filtered briefing includes that topic. The returned topic
    id is used to peel that theme from downstream sections (rollup, deep dives) so it is not
    shown twice in the same issue.
    """
    _ = topics
    if not hot_data:
        return None, None, None
    ht = hot_data.get("hot_topic")
    ha = hot_data.get("hot_article")
    if not isinstance(ht, dict) or not isinstance(ha, dict):
        return None, None, None
    try:
        peel_id = int(ht["id"])
    except (KeyError, TypeError, ValueError):
        return None, None, None
    if not (str(ha.get("title") or "").strip() or str(ha.get("url") or "").strip()):
        return None, None, None
    return ht, ha, peel_id


def _build_top_stories_block(
    topics: list[Topic],
    *,
    db: Session | None = None,
    subscriber: Subscriber | None = None,
    role_objs: list | None = None,
    ingest_cutoffs: NewsletterArticleIngestCutoffs | None = None,
    include_lead_image: bool = True,
) -> str:
    role_names: list[str] | None = None
    if role_objs:
        names = [(getattr(r, "name", None) or "").strip() for r in role_objs]
        role_names = [n for n in names if n] or None
    chain = (
        _newsletter_article_pick_cutoffs(ingest_cutoffs) if ingest_cutoffs is not None else [None]
    )
    rows = []
    for idx, t in enumerate(topics):
        first_art: Article | None = None
        if db is not None:
            for cutoff in chain:
                arts = select_articles_for_newsletter_topic(
                    t,
                    db,
                    role_names,
                    article_ingested_after=cutoff,
                    limit=1,
                )
                if arts:
                    first_art = arts[0]
                    break
        summ = ""
        if first_art is not None:
            summ = _article_teaser_for_email(first_art).strip()
        if not summ:
            summ = _first_sentences(t.summary, 3).strip()
        if not summ:
            summ = _subscriber_industry_teaser(t, subscriber)
        if not summ:
            summ = "This theme is on your radar — open the full briefing below for linked sources and context."
        read_more = ""
        if first_art and (first_art.url or "").strip():
            u = html.escape(first_art.url.strip())
            read_more = (
                f'<br><a href="{u}" style="color:#019E7C;font-weight:600;text-decoration:none;font-size:13px;">'
                f"Read more</a>"
            )
        lead_img = ""
        if include_lead_image and idx == 0 and first_art is not None:
            src = _newsletter_image_url_for_article(first_art, t.domain)
            lead_img = (
                f'<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border-radius:8px;overflow:hidden;">'
                f'<tr><td style="padding:0;line-height:0;background:#E5E7EB;">'
                f'<a href="{html.escape(first_art.url or "#")}" style="text-decoration:none;">'
                f'<img src="{html.escape(src)}" width="536" alt="" '
                f'style="display:block;width:100%;max-width:536px;height:auto;border:0;" />'
                f"</a></td></tr></table>"
            )
        rows.append(
            f'<div style="margin:0 0 18px;font-family:{_FF};">'
            f"{lead_img}"
            f'<span style="font-size:15px;font-weight:700;color:#111827;">{html.escape(t.name)}</span><br>'
            f'<span style="font-size:13px;color:#4A5F6D;line-height:1.6;">{html.escape(summ)}{read_more}</span>'
            f"</div>"
        )
    return (
        "\n".join(rows)
        if rows
        else (
            f'<p style="margin:0;font-size:13px;color:#4A5F6D;font-family:{_FF};">No top stories this issue.</p>'
        )
    )


def _build_hot_topic_lead_html(hot_topic: dict, hot_article: dict) -> str:
    """
    Lead block for today's global hot topic — same payload as admin Daily trends
    (``build_hot_of_day``), shown at the top of every issue when configured.
    """
    dom = html.escape((hot_topic.get("domain") or "").strip())
    sub = html.escape((hot_topic.get("subdomain") or "").strip())
    dom_line = dom
    if sub:
        dom_line = f"{dom} &middot; {sub}" if dom else sub
    domain_row = ""
    if dom_line:
        domain_row = (
            f'<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#4A5F6D;font-family:{_FF};">'
            f"{dom_line}</p>"
        )
    title = html.escape(hot_article.get("title") or "Read article")
    url = html.escape(hot_article.get("url") or "#")
    src = html.escape((hot_article.get("source_name") or "").strip() or "Source")
    ing = hot_article.get("ingested_at")
    ing_part = ""
    if ing:
        ing_part = f" &middot; Ingested {_format_dt_for_email_hot(ing)}"
    meta = f"{src}{ing_part}"
    tname = html.escape(hot_topic.get("name") or "Hot topic")
    img_raw = (hot_article.get("image_url") or "").strip() or _hero_image_url_for_domain(
        hot_topic.get("domain")
    )
    img_block = f"""
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-radius:6px;overflow:hidden;">
            <tr><td style="padding:0;line-height:0;background:#E5E7EB;">
              <a href="{url}" style="text-decoration:none;">
                <img src="{html.escape(img_raw)}" width="520" alt="" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />
              </a>
            </td></tr>
          </table>"""
    summary_rows: list[str] = []
    for label, key in (("What is it?", "what_is_it"), ("Why is it important?", "why_it_matters")):
        body = _first_sentence(str(hot_article.get(key) or "").strip())
        if not body:
            continue
        summary_rows.append(
            f"""
          <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#374151;font-family:{_FF};">
            <span style="font-weight:700;color:#111827;">{label}</span> {html.escape(body)}
          </p>"""
        )
    summary_block = "".join(summary_rows)
    return f"""
<tr>
  <td style="padding:0 32px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8FA;border-radius:8px;border:1px solid #E5E7EB;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;border-left:4px solid #E91D24;">
          {img_block}
          <p style="margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;
                    color:#E91D24;font-family:{_FF};">Hot on your radar &mdash; today</p>
          {domain_row}
          <p style="margin:0 0 10px;font-size:18px;font-weight:700;line-height:1.3;font-family:{_FF};">
            <a href="{url}" style="color:#E91D24;text-decoration:none;">{title}</a>
          </p>
          <p style="margin:0 0 4px;font-size:12px;color:#6B7280;font-family:{_FF};">{meta}</p>
          <p style="margin:8px 0 0;font-size:12px;font-weight:600;font-family:{_FF};">
            <span style="color:#4A5F6D;">Topic: </span><span style="color:#111827;">{tname}</span>
          </p>
          {summary_block}
        </td>
      </tr>
    </table>
  </td>
</tr>
"""


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
    dom = topic_domain_short(topic)
    color = _topic_domain_color(topic)
    posture_label = _adoption_label(topic)
    posture = html.escape(posture_label)
    badge_bg, badge_fg = _posture_badge_colors(topic)
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
    merged_pipeline: MergedPipelineSettings | None = None,
    *,
    hot_of_day: dict[str, Any] | None = None,
    read_online_url_override: str | None = None,
) -> str:
    role_objs = _resolve_subscriber_roles(subscriber, db)
    role_footer = ", ".join(
        (getattr(r, "name", None) or "").strip()
        for r in role_objs
        if (getattr(r, "name", None) or "").strip()
    )
    role_display = role_footer or "Leader"
    public_site = (settings.public_site_url or "http://localhost:3100").rstrip("/")

    merged_eff = merged_pipeline or (
        merge_pipeline_settings(db) if db is not None else merge_pipeline_settings(None)
    )
    ingest = newsletter_article_ingest_cutoffs(merged_eff)

    hot_data: dict[str, Any] | None = None
    if db is not None:
        if hot_of_day is not None:
            hot_data = hot_of_day
        else:
            try:
                hot_data = build_hot_of_day(db)
            except Exception:
                logger.debug("build_hot_of_day failed for newsletter HTML", exc_info=True)
                hot_data = {"hot_topic": None, "hot_article": None}
    elif hot_of_day is not None:
        hot_data = hot_of_day

    sorted_topics: list[Topic]
    if db is not None:
        try:
            sorted_topics = sort_topics_for_newsletter_profile(
                db,
                list(topics),
                subscriber,
                role_objs,
                article_after=ingest.top_rank_peak,
            )
        except Exception:
            logger.warning(
                "Newsletter profile topic sort failed — using urgency order.",
                exc_info=True,
            )
            sorted_topics = sorted(topics, key=lambda t: t.urgency_score, reverse=True)
    else:
        sorted_topics = sorted(topics, key=lambda t: t.urgency_score, reverse=True)

    ht, ha, hot_topic_id_for_sections = _resolve_hot_topic_lead_for_subscriber(topics, hot_data)
    hot_lead_html = _build_hot_topic_lead_html(ht, ha) if ht and ha else ""

    headline_for_header: str | None = None
    if isinstance(ha, dict):
        raw_h = (ha.get("title") or "").strip()
        if raw_h:
            headline_for_header = raw_h
    header_banner_html = _build_newsletter_header_banner_html(
        headline_article_title=headline_for_header,
    )

    if hot_topic_id_for_sections is not None:
        rest_topics = [t for t in sorted_topics if t.id != hot_topic_id_for_sections]
    else:
        rest_topics = list(sorted_topics)

    top_stories = rest_topics[:3]
    deep_dives = rest_topics[3:7]
    quick_hits = rest_topics[7:]

    top_stories_html = _build_top_stories_block(
        top_stories,
        db=db,
        subscriber=subscriber,
        role_objs=role_objs,
        ingest_cutoffs=ingest,
        include_lead_image=not bool(hot_lead_html),
    )

    deep_parts = []
    if db is not None:
        for topic in deep_dives:
            arts = _select_articles_for_topic(
                topic, db, role_objs, article_ingested_after=ingest.deep_dive_primary
            )
            if not arts:
                arts = _select_articles_for_topic(
                    topic, db, role_objs, article_ingested_after=ingest.legacy_fallback
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
    api_base = (settings.api_base_url or "http://localhost:8000").rstrip("/")
    survey_html = _build_survey_block(api_base, subscriber.email, newsletter_date)
    briefing_page = f"{public_site}/"
    read_online_url = read_online_url_override or briefing_page
    social = _newsletter_social_urls(briefing_page)
    preferences_token = create_subscriber_preferences_token(subscriber)
    preferences_page = f"{public_site}/preferences?token={quote(preferences_token, safe='')}"
    unsubscribe_page = f"{preferences_page}&unsubscribe=1"

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
        read_online_url=html.escape(read_online_url),
        share_x_url=html.escape(social["share_x"]),
        share_linkedin_url=html.escape(social["share_linkedin"]),
        forward_mailto_url=html.escape(social["forward_mailto"]),
        manage_preferences_url=html.escape(preferences_page),
        unsubscribe_url=html.escape(unsubscribe_page),
        first_name=html.escape(subscriber.first_name or "there"),
        industry_line=html.escape(industry_line) if industry_line else "",
        header_banner_html=header_banner_html,
        hot_lead_html=hot_lead_html,
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
    *,
    merged_pipeline: MergedPipelineSettings | None = None,
    hot_of_day: dict[str, Any] | None = None,
) -> tuple[bool, str | None]:
    """
    Send a personalized newsletter to one subscriber.

    Always uses the built-in full HTML briefing (hot lead, top stories, deep dives,
    quick hits, tip, survey). SendGrid receives ``html_content`` only — no dynamic template.

    Ingest windows (top rollup vs deep dives vs fallback) come from ``merged_pipeline``.
    When omitted, merges from ``db`` or environment defaults.

    Returns (True, None) if accepted by SendGrid (HTTP 202), or (False, reason) on failure.
    """
    sg = _get_sg_client()
    roles = _resolve_subscriber_roles(subscriber, db)

    from_email = Email(
        email=settings.sendgrid_from_email,
        name=settings.sendgrid_from_name,
    )

    hot_data: dict[str, Any] | None = None
    if db is not None:
        if hot_of_day is not None:
            hot_data = hot_of_day
        else:
            try:
                hot_data = build_hot_of_day(db)
            except Exception:
                logger.debug("build_hot_of_day failed for newsletter send", exc_info=True)
                hot_data = {"hot_topic": None, "hot_article": None}

    merged_eff = merged_pipeline or (
        merge_pipeline_settings(db) if db is not None else merge_pipeline_settings(None)
    )

    subject, _ = _newsletter_subject_and_headline(topics, roles, hot_data)
    issue = NewsletterIssue(
        subscriber_email=subscriber.email,
        subject=subject,
        html="pending",
    )
    read_online_url: str | None = None
    if db is not None:
        db.add(issue)
        db.flush()
        read_online_url = _newsletter_issue_url(issue.token)

    html_body = _build_html(
        subscriber,
        topics,
        db=db,
        promoted_content=promoted_content,
        merged_pipeline=merged_eff,
        hot_of_day=hot_data,
        read_online_url_override=read_online_url,
    )
    if db is not None:
        issue.html = html_body
        db.commit()
    message = Mail(
        from_email=from_email,
        to_emails=To(email=subscriber.email),
        subject=Subject(subject),
        html_content=Content("text/html", html_body),
    )

    try:
        response = sg.send(message)
        accepted = response.status_code == 202
        if accepted:
            logger.info("Newsletter sent to %s (%d topics)", subscriber.email, len(topics))
            return True, None
        detail = f"SendGrid returned HTTP {response.status_code} (expected 202)."
        logger.warning("Unexpected SendGrid status for %s: %s", subscriber.email, detail)
        return False, detail
    except Exception as exc:
        detail = _format_sendgrid_error(exc)
        logger.exception(
            "SendGrid error for subscriber %s: %s",
            subscriber.email,
            detail,
        )
        return False, detail or "SendGrid request failed."


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


def _domain_allow_for_newsletter(subscriber: Subscriber) -> set[str] | None:
    """
    Subscriber-selected radar pillars (wizard ``domains``) for topic domain matching.

    When set, themes not in those pillars are excluded from the **first-pass** cohort; the
    newsletter assembler may widen beyond them when ingest-driven tiers still fall below the
    minimum topic count.

    Legacy subscribers with empty domains receive ``None`` (no pillar gate — full pipeline cohort).
    """
    domains = getattr(subscriber, "domains", None)
    if domains:
        return {d for d in domains if d}
    return None


def _domain_topics_for_subscriber(all_approved: list[Topic], subscriber: Subscriber) -> list[Topic]:
    """Topics whose ``domain`` matches wizard picks; legacy subscribers get the full cohort."""
    allow = _domain_allow_for_newsletter(subscriber)
    if allow is None:
        return list(all_approved)
    allow_l = {x.lower() for x in allow}
    return [t for t in all_approved if topic_domain_slug_for_filter(t) in allow_l]


def _subscriber_industry_labels(subscriber: Subscriber | object) -> list[str]:
    raw = getattr(subscriber, "industries", None) or []
    return [str(x).strip() for x in raw if x is not None and str(x).strip()]


def _industry_signals_for_article(topic: Topic, article: Article, industries: list[str]) -> bool:
    if not industries:
        return True
    ip = topic.industry_positions
    if isinstance(ip, dict):
        for ind in industries:
            il = ind.strip().lower()
            if len(il) < 2:
                continue
            for key in ip.keys():
                if il in str(key).lower():
                    return True
    return any(article_industry_bonus(article, ind) > 0 for ind in industries)


def _newsletter_first_article_via_chain(
    topic: Topic,
    db: Session,
    role_names: list[str] | None,
    ingest: NewsletterArticleIngestCutoffs,
) -> Article | None:
    for cutoff in _newsletter_article_pick_cutoffs(ingest):
        arts = select_articles_for_newsletter_topic(
            topic,
            db,
            role_names,
            article_ingested_after=cutoff,
            limit=1,
        )
        if arts:
            return arts[0]
    return None


def _sort_topics_by_urgency_desc(topics: list[Topic]) -> list[Topic]:
    return sorted(topics, key=lambda t: float(t.urgency_score or 0.0), reverse=True)


def _assemble_topics_strict_profile(
    cohort: list[Topic],
    *,
    db: Session,
    subscriber: Subscriber | object,
    role_names: list[str] | None,
    ingest: NewsletterArticleIngestCutoffs,
) -> list[Topic]:
    industries = _subscriber_industry_labels(subscriber)
    pool: list[Topic] = []
    for topic in cohort:
        art = _newsletter_first_article_via_chain(topic, db, role_names, ingest)
        if art is None:
            continue
        if industries and not _industry_signals_for_article(topic, art, industries):
            continue
        if not article_has_persona_for_roles(art, role_names):
            continue
        pool.append(topic)
    return pool


def _assemble_topics_industry_domains(
    cohort: list[Topic],
    *,
    db: Session,
    subscriber: Subscriber | object,
    role_names: list[str] | None,
    ingest: NewsletterArticleIngestCutoffs,
) -> list[Topic]:
    industries = _subscriber_industry_labels(subscriber)
    pool: list[Topic] = []
    for topic in cohort:
        art = _newsletter_first_article_via_chain(topic, db, role_names, ingest)
        if art is None:
            continue
        if industries and not _industry_signals_for_article(topic, art, industries):
            continue
        pool.append(topic)
    return pool


def _assemble_topics_fresh_domains(
    cohort: list[Topic],
    *,
    db: Session,
    role_names: list[str] | None,
    ingest: NewsletterArticleIngestCutoffs,
) -> list[Topic]:
    pool: list[Topic] = []
    for topic in cohort:
        if _newsletter_first_article_via_chain(topic, db, role_names, ingest) is not None:
            pool.append(topic)
    return pool


def _assemble_topics_cross_domain_industry(
    all_approved: list[Topic],
    *,
    db: Session,
    subscriber: Subscriber | object,
    role_names: list[str] | None,
    ingest: NewsletterArticleIngestCutoffs,
) -> list[Topic]:
    industries = _subscriber_industry_labels(subscriber)
    if not industries:
        return []
    pool: list[Topic] = []
    for topic in all_approved:
        art = _newsletter_first_article_via_chain(topic, db, role_names, ingest)
        if art is None:
            continue
        if _industry_signals_for_article(topic, art, industries):
            pool.append(topic)
    return pool


def _resolve_newsletter_topic_pool(
    *,
    subscriber: Subscriber,
    all_approved: list[Topic],
    db: Session,
    merged_pipeline: MergedPipelineSettings,
    min_topics: int = NEWSLETTER_ASSEMBLY_MIN_TOPICS,
) -> tuple[list[Topic], str]:
    ingest = newsletter_article_ingest_cutoffs(merged_pipeline)
    cohort_dom = _domain_topics_for_subscriber(all_approved, subscriber)
    role_objs = _resolve_subscriber_roles(subscriber, db)
    names = [(getattr(r, "name", None) or "").strip() for r in role_objs]
    role_names = [n for n in names if n] or None

    tier_specs: list[tuple[str, Callable[[], list[Topic]]]] = [
        (
            "industry_domains_persona_fresh",
            lambda: _assemble_topics_strict_profile(
                cohort_dom,
                db=db,
                subscriber=subscriber,
                role_names=role_names,
                ingest=ingest,
            ),
        ),
        (
            "industry_domains_fresh",
            lambda: _assemble_topics_industry_domains(
                cohort_dom,
                db=db,
                subscriber=subscriber,
                role_names=role_names,
                ingest=ingest,
            ),
        ),
        (
            "domains_fresh_articles",
            lambda: _assemble_topics_fresh_domains(
                cohort_dom,
                db=db,
                role_names=role_names,
                ingest=ingest,
            ),
        ),
        ("domains_only", lambda: list(cohort_dom)),
        (
            "cross_domain_industry_fresh",
            lambda: _assemble_topics_cross_domain_industry(
                all_approved,
                db=db,
                subscriber=subscriber,
                role_names=role_names,
                ingest=ingest,
            ),
        ),
        ("all_pipeline_topics", lambda: list(all_approved)),
    ]

    best_pick: tuple[int, list[Topic], str] | None = None
    for idx, (label, lazy_fn) in enumerate(tier_specs):
        pool = lazy_fn()
        if len(pool) >= min_topics:
            logger.info(
                "Newsletter topic assembly: tier=%s count=%d (≥ min %d) email=%s",
                label,
                len(pool),
                min_topics,
                getattr(subscriber, "email", "?"),
            )
            return _sort_topics_by_urgency_desc(pool), label
        if pool:
            if (
                best_pick is None
                or len(pool) > len(best_pick[1])
                or (len(pool) == len(best_pick[1]) and idx < best_pick[0])
            ):
                best_pick = (idx, pool, label)

    if best_pick:
        _, plist, lbl = best_pick
        logger.warning(
            "Newsletter topic assembly below min tier=%s count=%d wanted≥%d email=%s "
            "(use best-available pool)",
            lbl,
            len(plist),
            min_topics,
            getattr(subscriber, "email", "?"),
        )
        return _sort_topics_by_urgency_desc(plist), lbl

    return [], "empty"


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
    merged_pipeline: MergedPipelineSettings | None = None,
) -> list[Topic]:
    """
    Narrow pipeline topics by subscriber wizard preferences, relaxing when ingest is sparse.

    - **Technology (domains)** from preferences narrows eligible themes first.

    With ``merged_pipeline`` + ``db``, applies a ladder until at least
    ``NEWSLETTER_ASSEMBLY_MIN_TOPICS`` qualifying topics emerge (Industry + persona + fresh
    article → Industry + fresh → domains with any fresh ingest → domains only → industry
    match across pillars → entire pipeline cohort). Prefer the strictest tier that clears
    the minimum; otherwise the largest pool wins (preferring tighter tiers on ties).

    ``skip_domain_filter=True`` skips domain narrowing **and** the ladder (preview / sandbox).

    When ``merged_pipeline`` or ``db`` is omitted, behaves as legacy **domain-filter only**.
    """
    if skip_domain_filter:
        return sorted(all_approved, key=lambda t: t.urgency_score, reverse=True)

    if merged_pipeline is None or db is None:
        cohort = _domain_topics_for_subscriber(all_approved, subscriber)
        return sorted(cohort, key=lambda t: t.urgency_score, reverse=True)

    cohort, _label = _resolve_newsletter_topic_pool(
        subscriber=subscriber,
        all_approved=all_approved,
        db=db,
        merged_pipeline=merged_pipeline,
    )
    return cohort


def generate_newsletter_preview(
    db: Session,
    industries: list[str] | None = None,
    domains: list[str] | None = None,
    role_ids: list[int] | None = None,
) -> str:
    """
    Build and return a rendered HTML newsletter for a simulated subscriber.

    Uses up to 20 topics from the **same cohort as the scheduled newsletter**: watched or
    selected pipeline topics only (not ``is_published``-only rows).

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
        .filter(Topic.status.in_([TopicStatus.watched, TopicStatus.selected]))
        .order_by(Topic.urgency_score.desc())
        .all()
    )

    merged = merge_pipeline_settings(db)
    topics = assemble_newsletter_topics(
        dummy,
        eligible,
        db,
        skip_domain_filter=skip_domain_topic_filter,
        merged_pipeline=None if skip_domain_topic_filter else merged,
    )[:20]

    if not topics:
        no_match = f" matching your domain picks ({', '.join(domain_list)})" if domain_list else ""
        return (
            "<!DOCTYPE html><html><body style='background:#F3F4F6;"
            "color:#374151;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:40px;'>"
            f"<h2 style='color:#111827;'>No topics available for preview{no_match}.</h2>"
            "<p>Promote topics in Research (watched/selected), publish topics to the live Radar, "
            "or clear domain filters.</p>"
            "</body></html>"
        )

    promoted = assemble_promoted_content(dummy, db)
    return _build_html(
        dummy,
        topics,
        db=db,
        promoted_content=promoted,
        merged_pipeline=merged,
    )


def run_daily_newsletter(db: Session) -> None:
    """
    Fetch all active subscribers and dispatch newsletters for watched/selected (on-radar) topics.

    Article pools use tiered ingest cutoffs from pipeline settings: a short window for
    topic ranking and top rollup, a ~48–72h primary pool for deep-dive sources, and a
    slightly wider day-based fallback when per-topic selection would otherwise be empty.
    """
    merged = merge_pipeline_settings(db)
    if not merged.newsletter_enabled:
        logger.info("Daily newsletter: disabled (newsletter_enabled=false)")
        return
    if not settings.sendgrid_api_key:
        logger.warning("Daily newsletter: SENDGRID_API_KEY not set — skipping send")
        return

    ingest = newsletter_article_ingest_cutoffs(merged)

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
        "Daily newsletter: %d topics, %d subscribers "
        "(ingest cutoffs ingested≥ top %s · deep %s · legacy %s UTC)",
        len(eligible_topics),
        len(subscribers),
        ingest.top_rank_peak.strftime("%Y-%m-%dT%H:%MZ"),
        ingest.deep_dive_primary.strftime("%Y-%m-%dT%H:%MZ"),
        ingest.legacy_fallback.strftime("%Y-%m-%dT%H:%MZ"),
    )

    try:
        batch_hot = build_hot_of_day(db)
    except Exception:
        logger.debug("build_hot_of_day failed for daily newsletter batch", exc_info=True)
        batch_hot = {"hot_topic": None, "hot_article": None}

    sent = 0
    delay_s = settings.newsletter_subscriber_delay_seconds
    for i, subscriber in enumerate(subscribers):
        matched = assemble_newsletter_topics(
            subscriber,
            eligible_topics,
            db,
            merged_pipeline=merged,
        )
        if matched:
            promoted = assemble_promoted_content(subscriber, db)
            ok, sg_err = send_daily_newsletter(
                subscriber,
                matched,
                db=db,
                promoted_content=promoted,
                merged_pipeline=merged,
                hot_of_day=batch_hot,
            )
            if ok:
                sent += 1
            elif sg_err:
                logger.warning(
                    "Newsletter send failed for subscriber %s: %s",
                    subscriber.email,
                    sg_err,
                )
        if delay_s > 0 and i < len(subscribers) - 1:
            time.sleep(delay_s)

    if sent > 0:
        set_last_newsletter_sent_at(db)

    logger.info("Daily newsletter: %d emails dispatched", sent)


def send_test_newsletter(db: Session, to_email: str) -> tuple[bool, str]:
    """
    Send one real newsletter to an arbitrary address for admin QA.

    **Pipeline only:** topics must be ``watched`` or ``selected`` (on-radar pipeline). This
    matches Radar Preview “Pipeline staging” and the scheduled newsletter — it does **not**
    pull topics that appear on the live site only via ``is_published`` without pipeline status.

    Article ingest windows match merged pipeline settings (top rollup vs deep-dive tiers).
    so all pipeline topics are included (like a subscriber who did not filter domains).

    Does not update last_newsletter_sent_at. Requires SENDGRID_API_KEY.
    """
    raw = (to_email or "").strip().lower()
    if not raw or "@" not in raw:
        return False, "Invalid email address."

    if not settings.sendgrid_api_key:
        return False, "SENDGRID_API_KEY is not set — cannot send email."

    merged = merge_pipeline_settings(db)

    # Watched + selected only — pipeline cohort, not “published to live site” alone.
    eligible_topics: list[Topic] = (
        db.query(Topic).filter(Topic.status.in_([TopicStatus.watched, TopicStatus.selected])).all()
    )
    if not eligible_topics:
        return (
            False,
            "No watched or selected topics — promote topics in Research (Trending) first.",
        )

    dummy = Subscriber(
        id=-1,
        email=raw,
        first_name="Test",
        last_name="Reader",
        industries=["Technology"],
        domains=None,
        role_ids=None,
        is_active=True,
    )
    matched = assemble_newsletter_topics(dummy, eligible_topics, db, merged_pipeline=merged)
    if not matched:
        return False, "No topics matched for this send (unexpected)."

    promoted = assemble_promoted_content(dummy, db)
    ok, sg_err = send_daily_newsletter(
        dummy,
        matched,
        db=db,
        promoted_content=promoted,
        merged_pipeline=merged,
    )
    if ok:
        return True, f"Test newsletter sent to {raw} ({len(matched)} topic(s))."
    if sg_err:
        return (
            False,
            "SendGrid rejected the message. "
            + sg_err
            + " — verify SENDGRID_API_KEY and sender verification (From address).",
        )
    return False, "SendGrid did not accept the message — check server logs."


def send_admin_invite_email(to_email: str, temporary_password: str, login_url: str) -> bool:
    """
    Email an invited admin user their temporary password.
    Returns False if SendGrid is not configured or the send fails.
    """
    if not settings.sendgrid_api_key:
        logger.warning("SENDGRID_API_KEY not set; admin invite email not sent to %s", to_email)
        return False
    sg = _get_sg_client()
    from_email = Email(
        email=settings.sendgrid_from_email,
        name=settings.sendgrid_from_name,
    )
    safe_pw = html.escape(temporary_password, quote=True)
    safe_url = html.escape(login_url, quote=True)
    safe_em = html.escape(to_email, quote=True)
    plain = (
        f"You have been invited to the PulseOne admin console.\n\n"
        f"Sign in: {login_url}\n"
        f"Email: {to_email}\n"
        f"Temporary password: {temporary_password}\n\n"
        "You will be asked to choose a new password after signing in."
    )
    html_body = (
        f"<p>You have been invited to the PulseOne admin console.</p>"
        f'<p><a href="{safe_url}">Sign in</a></p>'
        f"<p>Email: {safe_em}</p>"
        f"<p>Temporary password: <code>{safe_pw}</code></p>"
        "<p>You will be asked to choose a new password after signing in.</p>"
    )
    message = Mail(
        from_email=from_email,
        to_emails=To(email=to_email),
        subject="PulseOne admin access",
        plain_text_content=Content("text/plain", plain),
        html_content=Content("text/html", html_body),
    )
    try:
        response = sg.send(message)
        if response.status_code != 202:
            logger.warning(
                "Unexpected SendGrid status %d for admin invite to %s",
                response.status_code,
                to_email,
            )
        return response.status_code == 202
    except Exception:
        logger.exception("SendGrid error sending admin invite to %s", to_email)
        return False


def send_contact_form_notification(
    *,
    name: str,
    email: str,
    company: str,
    message: str,
    phone: str | None = None,
    industry: str | None = None,
    role: str | None = None,
) -> tuple[bool, str | None]:
    """
    Email marketing (or ``CONTACT_FORM_TO_EMAIL``) when someone submits `/contact`.

    Returns (True, None) on SendGrid accept (HTTP 202), else (False, reason).
    """
    if not settings.sendgrid_api_key:
        logger.warning("SENDGRID_API_KEY not set; contact form email not sent for %s", email)
        return False, "SendGrid not configured"

    to_addr = (settings.contact_form_to_email or "").strip()
    if not to_addr:
        logger.warning("CONTACT_FORM_TO_EMAIL not set; contact form email not sent for %s", email)
        return False, "Contact form recipient not configured"

    sg = _get_sg_client()
    from_email = Email(
        email=settings.sendgrid_from_email,
        name=settings.sendgrid_from_name,
    )

    def _row(label: str, value: str) -> str:
        safe_label = html.escape(label, quote=True)
        safe_val = html.escape(value, quote=True)
        return f'<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top">{safe_label}</td><td>{safe_val}</td></tr>'

    optional_rows: list[str] = []
    plain_optional: list[str] = []
    for label, val in (
        ("Phone", phone),
        ("Industry", industry),
        ("Role", role),
    ):
        if val:
            optional_rows.append(_row(label, val))
            plain_optional.append(f"{label}: {val}")

    safe_email = html.escape(email, quote=True)
    safe_message = html.escape(message, quote=True).replace("\n", "<br>")

    subject = f"PulseOne contact form — {name} ({company})"
    plain = (
        f"New contact form submission from pulseone.com/contact\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Company: {company}\n"
        + ("\n".join(plain_optional) + "\n" if plain_optional else "")
        + f"\nMessage:\n{message}\n"
    )
    html_body = (
        "<p>New contact form submission from <strong>pulseone.com/contact</strong>.</p>"
        '<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">'
        f"{_row('Name', name)}{_row('Email', email)}{_row('Company', company)}"
        f"{''.join(optional_rows)}"
        f"</table>"
        f'<p style="margin-top:16px"><strong>Message</strong></p>'
        f"<p>{safe_message}</p>"
        f'<p style="margin-top:16px;font-size:13px;color:#666">'
        f"Reply directly to {safe_email}.</p>"
    )

    message_obj = Mail(
        from_email=from_email,
        to_emails=To(email=to_addr),
        subject=Subject(subject),
        plain_text_content=Content("text/plain", plain),
        html_content=Content("text/html", html_body),
    )
    message_obj.reply_to = ReplyTo(email=email, name=name)

    try:
        response = sg.send(message_obj)
        if response.status_code != 202:
            detail = f"SendGrid returned HTTP {response.status_code} (expected 202)."
            logger.warning("Unexpected SendGrid status for contact form (%s): %s", email, detail)
            return False, detail
        logger.info("Contact form notification sent to %s for %s", to_addr, email)
        return True, None
    except Exception as exc:
        detail = _format_sendgrid_error(exc)
        logger.exception("SendGrid error sending contact form notification for %s", email)
        return False, detail or "SendGrid request failed."
