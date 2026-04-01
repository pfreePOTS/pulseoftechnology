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
from sqlalchemy.orm import Session

from ..config import settings
from ..models.article import Article
from ..models.content import ContentItem
from ..models.subscriber import Subscriber
from ..models.topic import Topic, TopicStatus
from .pipeline_settings import merge_pipeline_settings, set_last_newsletter_sent_at

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


def _adoption_label(topic: Topic) -> str:
    a = topic.adoption_state
    if a is None:
        return ""
    return a.value if hasattr(a, "value") else str(a)


def _select_articles_for_topic(
    topic: Topic,
    db: Session,
    role_tags: set[str] | None,
    *,
    article_ingested_after: datetime | None = None,
) -> list[Article]:
    q = db.query(Article).filter(
        Article.topic_id == topic.id,
        Article.what_is_it.isnot(None),
        Article.archived_at.is_(None),
    )
    if article_ingested_after is not None:
        q = q.filter(Article.ingested_at >= article_ingested_after)
    raw_candidates: list[Article] = q.all()
    candidates = [
        a
        for a in raw_candidates
        if (a.why_it_matters and str(a.why_it_matters).strip())
        or (
            isinstance(a.persona_impacts, dict)
            and any(str(v).strip() for v in a.persona_impacts.values())
        )
    ]

    if role_tags:
        matched = [a for a in candidates if {t.lower() for t in (a.tags or [])} & role_tags]
        if not matched:
            candidates.sort(
                key=lambda a: a.published_at or datetime.min.replace(tzinfo=UTC),
                reverse=True,
            )
            return candidates[:3]
        matched.sort(
            key=lambda a: a.published_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
        return matched[:3]

    candidates.sort(
        key=lambda a: a.published_at or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
    return candidates[:3]


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
    role_obj: object | None,
) -> str | None:
    if role_obj is None:
        return None
    name = getattr(role_obj, "name", None)
    if not name:
        return None
    pbr = topic.persona_by_role
    if isinstance(pbr, dict):
        v = pbr.get(name)
        if isinstance(v, str) and v.strip():
            return v.strip()
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
              Domains: {domains_label} &middot; Industry: {industry_label}
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


def _build_top_stories_block(topics: list[Topic]) -> str:
    rows = []
    for t in topics:
        summ = _first_sentences(t.summary, 3)
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
    role_obj: object | None,
    role_name: str,
    subscriber: Subscriber | None = None,
) -> str:
    dom = topic.domain or "Other"
    color = _DOMAIN_COLORS.get(dom, "#6B7280")
    posture = html.escape(_adoption_label(topic))
    persona = _persona_text_for_topic(topic, articles, role_obj)
    persona_html = ""
    if persona:
        persona_html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#F4F8FA;border-left:3px solid #019E7C;border-radius:4px;">
      <tr>
        <td style="padding:12px 14px;font-family:{_FF};">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#111827;">What this means for you as a {html.escape(role_name)}:</p>
          <p style="margin:0;font-size:13px;color:#4A5F6D;line-height:1.6;">{html.escape(persona)}</p>
        </td>
      </tr>
    </table>"""

    art_links = []
    for a in articles:
        title = html.escape(a.title or "Read article")
        url = html.escape(a.url or "#")
        art_links.append(
            f'<p style="margin:6px 0 0;font-size:13px;font-family:{_FF};">'
            f'<a href="{url}" style="color:#019E7C;text-decoration:none;font-weight:600;">&rarr; {title}</a></p>'
        )
    arts = "\n".join(art_links) if art_links else ""

    summary_base = (topic.summary or "").strip() or "No summary available."
    industry_rationale_plain = ""
    if subscriber and subscriber.industry and isinstance(topic.industry_positions, dict):
        pos = topic.industry_positions.get(subscriber.industry)
        if isinstance(pos, dict) and pos.get("rationale"):
            industry_rationale_plain = f" For {subscriber.industry}: {pos['rationale']}"
    summary = html.escape(summary_base) + (
        html.escape(industry_rationale_plain) if industry_rationale_plain else ""
    )

    return f"""
<tr>
  <td style="padding:24px 32px 0;">
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 18px;">
    <p style="margin:0 0 6px;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;
              color:{color};font-family:{_FF};">{html.escape(dom.upper())}</p>
    <p style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111827;font-family:{_FF};line-height:1.25;">{html.escape(topic.name)}</p>
    <p style="margin:0 0 14px;font-family:{_FF};">
      <span style="display:inline-block;background:#019E7C;color:#FFFFFF;font-size:10px;font-weight:700;
                   letter-spacing:0.06em;text-transform:uppercase;border-radius:4px;padding:3px 10px;">
        YOUR POSTURE: {posture}
      </span>
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#111827;line-height:1.75;font-family:{_FF};">{summary}</p>
    {persona_html}
    {arts}
  </td>
</tr>
"""


def _build_quick_hits_block(topics: list[Topic]) -> str:
    if not topics:
        return ""
    items = []
    for t in topics:
        line = f"{t.name}: {_first_sentence(t.summary)}"
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
    role_tags: set[str] | None = None
    role_obj = getattr(subscriber, "role", None)
    if role_obj is None and db is not None and subscriber.role_id is not None:
        from ..models.role import Role

        role_obj = db.query(Role).filter(Role.id == subscriber.role_id).first()
    if role_obj and getattr(role_obj, "tags", None):
        role_tags = {t.lower() for t in role_obj.tags}

    role_name = (getattr(role_obj, "name", None) or "Leader").strip() or "Leader"

    sorted_topics = sorted(topics, key=lambda t: t.urgency_score, reverse=True)
    top_stories = sorted_topics[:3]
    deep_dives = sorted_topics[3:7]
    quick_hits = sorted_topics[7:]

    top_stories_html = _build_top_stories_block(top_stories)

    deep_parts = []
    if db is not None:
        for topic in deep_dives:
            arts = _select_articles_for_topic(
                topic, db, role_tags, article_ingested_after=article_ingested_after
            )
            deep_parts.append(
                _build_deep_dive_section(topic, arts, role_obj, role_name, subscriber=subscriber)
            )
    else:
        for topic in deep_dives:
            deep_parts.append(
                _build_deep_dive_section(topic, [], role_obj, role_name, subscriber=subscriber)
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

    industry_line = f" for the {subscriber.industry} sector" if subscriber.industry else ""

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
        industry_label=html.escape(subscriber.industry or "Not specified"),
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

    from_email = Email(
        email=settings.sendgrid_from_email,
        name=settings.sendgrid_from_name,
    )
    subject = (
        f"PulseOne Radar: {len(topics)} signal{'s' if len(topics) != 1 else ''} "
        f"this week — {_short_month_day(datetime.now(UTC))}"
    )

    if settings.sendgrid_newsletter_template_id:
        message = Mail(from_email=from_email)
        message.template_id = settings.sendgrid_newsletter_template_id
        p = Personalization()
        p.add_to(To(email=subscriber.email))
        p.dynamic_template_data = DynamicTemplateData(
            {
                "first_name": subscriber.first_name,
                "last_name": subscriber.last_name,
                "industry": subscriber.industry or "",
                "domains": subscriber.domains or [],
                "topics": [
                    {
                        "name": t.name,
                        "domain": t.domain,
                        "urgency_score": t.urgency_score,
                        "summary": t.summary or "",
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

    role_obj = getattr(subscriber, "role", None)
    role_tags: set[str] | None = None
    if role_obj and getattr(role_obj, "tags", None):
        role_tags = {t.lower() for t in role_obj.tags}

    if role_tags:
        matched = [
            item for item in all_active if {t.lower() for t in (item.tags or [])} & role_tags
        ]
        return matched[:3]

    return all_active[:3]


def assemble_newsletter_topics(
    subscriber: Subscriber,
    all_approved: list[Topic],
) -> list[Topic]:
    """
    Filter approved topics to those matching the subscriber's domain preferences.

    If the subscriber has no domain preferences, all approved topics are returned.
    Topics are returned in descending urgency order.
    """
    if not subscriber.domains:
        return sorted(all_approved, key=lambda t: t.urgency_score, reverse=True)

    matched = [t for t in all_approved if t.domain in subscriber.domains]
    return sorted(matched, key=lambda t: t.urgency_score, reverse=True)


def generate_newsletter_preview(
    db: Session,
    industry: str | None = None,
    domains: list[str] | None = None,
    role_id: int | None = None,
) -> str:
    """
    Build and return a rendered HTML newsletter for a simulated subscriber.

    Uses up to 20 watched/selected topics (by urgency) so tiered sections can be previewed.
    """
    from ..models.role import Role

    role = db.query(Role).filter(Role.id == role_id).first() if role_id else None

    dummy = Subscriber(
        id=-1,
        email="preview@pulseone.internal",
        first_name="Jane",
        last_name="Executive",
        industry=industry or "Technology",
        domains=domains if domains else None,
        role_id=role_id,
        is_active=True,
    )
    dummy.role = role  # type: ignore[attr-defined]

    eligible: list[Topic] = (
        db.query(Topic)
        .filter(Topic.status.in_([TopicStatus.watched, TopicStatus.selected]))
        .order_by(Topic.urgency_score.desc())
        .all()
    )

    topics = assemble_newsletter_topics(dummy, eligible)[:20]

    if not topics:
        no_match = f" matching your domain interests ({', '.join(domains)})" if domains else ""
        return (
            "<!DOCTYPE html><html><body style='background:#F3F4F6;"
            "color:#374151;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:40px;'>"
            f"<h2 style='color:#111827;'>No watched or selected topics{no_match}.</h2>"
            "<p>Watch topics in the Research step or broaden the domain filter.</p>"
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
        matched = assemble_newsletter_topics(subscriber, eligible_topics)
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
