"""
SendGrid email delivery service.

Public surface:
  send_daily_newsletter(subscriber, topics) -> bool
  run_daily_newsletter(db)               -> None   (called by scheduler)
"""

import logging
from datetime import UTC, datetime, timedelta

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


# ---------------------------------------------------------------------------
# HTML template helpers
# ---------------------------------------------------------------------------

_DOMAIN_COLORS: dict[str, str] = {
    "AI": "#818cf8",
    "Security": "#f87171",
    "Cloud": "#38bdf8",
    "Finance": "#34d399",
    "Leadership": "#fbbf24",
    "Other": "#94a3b8",
}

_TOPIC_BLOCK = """\
<tr>
  <td style="padding:0 0 24px 0;">
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="border-left:3px solid {domain_color};padding:4px 0 4px 18px;">
          <p style="margin:0 0 5px;font-size:10px;font-weight:700;letter-spacing:.1em;\
text-transform:uppercase;color:{domain_color};font-family:Arial,Helvetica,sans-serif;">\
{domain}</p>
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;\
font-family:Georgia,'Times New Roman',serif;line-height:1.3;">{name}</h2>
          <p style="margin:0;font-size:14px;color:#374151;\
font-family:Arial,Helvetica,sans-serif;line-height:1.75;">{summary}</p>
          {articles_html}
        </td>
      </tr>
    </table>
  </td>
</tr>
"""

_ARTICLE_BLOCK = """\
<table cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;">
  <tr>
    <td style="background:#f9fafb;border-radius:6px;padding:10px 14px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;\
font-family:Arial,Helvetica,sans-serif;">
        <a href="{url}" style="color:#4f46e5;text-decoration:none;">{title}</a>
      </p>
      <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#6b7280;\
font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.06em;">
        What is it
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#111827;\
font-family:Arial,Helvetica,sans-serif;line-height:1.6;">{what_is_it}</p>
      <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#6b7280;\
font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.06em;">
        Why it matters
      </p>
      <p style="margin:0;font-size:13px;color:#374151;\
font-family:Arial,Helvetica,sans-serif;line-height:1.6;">{why_it_matters}</p>
    </td>
  </tr>
</table>
"""

_EMAIL_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
  <tr>
    <td align="center" style="padding:24px 16px 40px;">

      <!-- ── Outer card ── -->
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;
                    overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

        <!-- TOP BAR -->
        <tr>
          <td style="background:#111827;padding:10px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#9ca3af;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                  {date}
                </td>
                <td align="right">
                  <a href="#" style="color:#9ca3af;font-size:11px;
                     font-family:Arial,Helvetica,sans-serif;text-decoration:none;">
                    Read online &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BRAND HEADER -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;
                      text-transform:uppercase;color:#6b7280;
                      font-family:Arial,Helvetica,sans-serif;">PulseOne Radar</p>
            <h1 style="margin:0;font-size:28px;font-weight:700;color:#111827;
                       font-family:Georgia,'Times New Roman',serif;line-height:1.2;">
              Your Intelligence Briefing
            </h1>
          </td>
        </tr>

        <!-- GREETING + INTRO -->
        <tr>
          <td style="padding:20px 32px 28px;">
            <p style="margin:0 0 12px;font-size:16px;color:#111827;
                      font-family:Georgia,'Times New Roman',serif;line-height:1.6;">
              Good morning, {first_name}.
            </p>
            <p style="margin:0;font-size:14px;color:#374151;
                      font-family:Arial,Helvetica,sans-serif;line-height:1.75;">
              Here are the top technology signals your team needs to know about{industry_line},
              curated by AI and reviewed by PulseOne experts.
            </p>
          </td>
        </tr>

        <!-- SECTION DIVIDER -->
        <tr>
          <td style="padding:0 32px 20px;">
            <hr style="border:none;border-top:2px solid #111827;margin:0 0 14px;">
            <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.12em;
                      text-transform:uppercase;color:#6b7280;
                      font-family:Arial,Helvetica,sans-serif;">
              YOUR DAILY ROLLUP &nbsp;&middot;&nbsp; Top Stories of the Day
            </p>
          </td>
        </tr>

        <!-- TOPIC BLOCKS -->
        <tr>
          <td style="padding:0 32px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              {topics_html}
            </table>
          </td>
        </tr>

        {promo_html}

        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;padding:24px 32px;
                     border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px;font-size:11px;color:#6b7280;line-height:1.6;
                      font-family:Arial,Helvetica,sans-serif;">
              You&rsquo;re receiving this because you subscribed to PulseOne Radar.<br>
              Domains: {domains_label} &nbsp;&middot;&nbsp; Industry: {industry_label}
            </p>
            <p style="margin:0;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
              <a href="#" style="color:#4f46e5;text-decoration:none;">Manage preferences</a>
              &nbsp;&nbsp;&middot;&nbsp;&nbsp;
              <a href="#" style="color:#4f46e5;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
"""

_TYPE_LABELS: dict[str, str] = {
    "article": "Article",
    "video": "Video",
    "landing_page": "Landing Page",
}

_PROMO_ITEM_BLOCK = """\
<tr>
  <td style="padding:0 0 14px 0;">
    <span style="display:inline-block;margin-bottom:4px;padding:2px 8px;
                 border-radius:4px;background:#e0e7ff;font-size:10px;font-weight:700;
                 text-transform:uppercase;letter-spacing:.06em;color:#4338ca;
                 font-family:Arial,Helvetica,sans-serif;">{type_label}</span>
    <p style="margin:0 0 4px;">
      <a href="{url}" style="font-size:15px;font-weight:700;color:#111827;
         font-family:Georgia,'Times New Roman',serif;text-decoration:none;
         line-height:1.3;">{title}</a>
    </p>
    {summary_html}
  </td>
</tr>
"""

_PROMO_SECTION = """\
<tr>
  <td style="padding:0 32px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f0f4ff;border-radius:8px;padding:20px 24px;">
      <tr>
        <td style="padding:0 0 14px 0;">
          <hr style="border:none;border-top:2px solid #4f46e5;margin:0 0 14px;">
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.12em;
                    text-transform:uppercase;color:#4f46e5;
                    font-family:Arial,Helvetica,sans-serif;">
            FROM PULSEONE &nbsp;&middot;&nbsp; Recommended Resources
          </p>
        </td>
      </tr>
      {promo_items}
    </table>
  </td>
</tr>
"""


def _build_html(
    subscriber: Subscriber,
    topics: list[Topic],
    db: Session | None = None,
    promoted_content: list[ContentItem] | None = None,
) -> str:
    # Resolve role tags — prefer already-attached role object, fall back to DB lookup
    role_tags: set[str] | None = None
    role_obj = getattr(subscriber, "role", None)
    if role_obj is None and db is not None and subscriber.role_id is not None:
        from ..models.role import Role

        role_obj = db.query(Role).filter(Role.id == subscriber.role_id).first()
    if role_obj and getattr(role_obj, "tags", None):
        role_tags = {t.lower() for t in role_obj.tags}

    topic_blocks = []
    for topic in topics:
        color = _DOMAIN_COLORS.get(topic.domain, "#6b7280")
        articles_html = ""

        if db is not None:
            # Fetch all articles for this topic that have summaries
            candidates: list[Article] = (
                db.query(Article)
                .filter(
                    Article.topic_id == topic.id,
                    Article.what_is_it.isnot(None),
                    Article.why_it_matters.isnot(None),
                )
                .all()
            )

            if role_tags:
                # Keep only articles whose tags intersect with the role's tags
                matched = [a for a in candidates if {t.lower() for t in (a.tags or [])} & role_tags]
                # If no matches, skip this topic entirely for this role
                if not matched:
                    continue
                # Sort by published_at descending, take top 3
                matched.sort(
                    key=lambda a: a.published_at or datetime.min.replace(tzinfo=UTC),
                    reverse=True,
                )
                selected = matched[:3]
            else:
                # No role filter — show top 3 by published_at
                candidates.sort(
                    key=lambda a: a.published_at or datetime.min.replace(tzinfo=UTC),
                    reverse=True,
                )
                selected = candidates[:3]

            articles_html = "\n".join(
                _ARTICLE_BLOCK.format(
                    title=a.title or "Read article",
                    url=a.url or "#",
                    what_is_it=a.what_is_it or "",
                    why_it_matters=a.why_it_matters or "",
                )
                for a in selected
            )

        topic_blocks.append(
            _TOPIC_BLOCK.format(
                domain_color=color,
                domain=topic.domain,
                name=topic.name,
                summary=topic.summary or "No summary available.",
                articles_html=articles_html,
            )
        )

    # ── Build promoted content section ──
    promo_html = ""
    if promoted_content:
        items_html = []
        for item in promoted_content[:3]:
            summary_html = (
                f'<p style="margin:0;font-size:13px;color:#374151;'
                f'font-family:Arial,Helvetica,sans-serif;line-height:1.6;">'
                f"{item.summary}</p>"
                if item.summary
                else ""
            )
            items_html.append(
                _PROMO_ITEM_BLOCK.format(
                    type_label=_TYPE_LABELS.get(item.type, item.type.replace("_", " ").title()),
                    url=item.url,
                    title=item.title,
                    summary_html=summary_html,
                )
            )
        promo_html = _PROMO_SECTION.format(promo_items="\n".join(items_html))

    industry_line = f" for the {subscriber.industry} sector" if subscriber.industry else ""
    return _EMAIL_TEMPLATE.format(
        first_name=subscriber.first_name,
        date=datetime.now(UTC).strftime("%B %-d, %Y"),
        industry_line=industry_line,
        topics_html="\n".join(topic_blocks),
        promo_html=promo_html,
        domains_label=", ".join(subscriber.domains or []) or "All",
        industry_label=subscriber.industry or "Not specified",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def send_daily_newsletter(
    subscriber: Subscriber,
    topics: list[Topic],
    db: Session | None = None,
    promoted_content: list[ContentItem] | None = None,
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
        f"this week — {datetime.now(UTC).strftime('%b %-d')}"
    )

    if settings.sendgrid_newsletter_template_id:
        # Dynamic template path
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
        # Built-in HTML template
        html_body = _build_html(subscriber, topics, db=db, promoted_content=promoted_content)
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

    Uses the 5 most recently approved topics so the preview is always
    populated regardless of the 24-hour recency window used by the real job.
    ``industry`` and ``domains`` control the simulated subscriber profile;
    ``role_id`` applies role-based article tag filtering.
    Does NOT write anything to the database or send any email.
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
    # Attach the role object directly so _build_html doesn't need a DB lookup
    dummy.role = role  # type: ignore[attr-defined]

    all_approved: list[Topic] = (
        db.query(Topic)
        .filter(Topic.status == TopicStatus.approved)
        .order_by(Topic.urgency_score.desc())
        .all()
    )

    topics = assemble_newsletter_topics(dummy, all_approved)[:5]

    if not topics:
        no_match = f" matching your domain interests ({', '.join(domains)})" if domains else ""
        return (
            "<!DOCTYPE html><html><body style='background:#f3f4f6;"
            "color:#374151;font-family:Arial,Helvetica,sans-serif;padding:40px;'>"
            f"<h2 style='color:#111827;'>No approved topics{no_match}.</h2>"
            "<p>Approve topics in the Curation Dashboard or broaden the domain filter.</p>"
            "</body></html>"
        )

    promoted = assemble_promoted_content(dummy, db)
    return _build_html(dummy, topics, db=db, promoted_content=promoted)


def run_daily_newsletter(db: Session) -> None:
    """
    Fetch all active subscribers, match them to recently-approved topics, and
    dispatch newsletters for those with at least one matching topic.

    "Recently approved" means the topic has at least one article ingested within
    the last 24 hours (used as a proxy for when the topic entered the pipeline).
    """
    from sqlalchemy import exists as sa_exists

    cutoff = datetime.now(UTC) - timedelta(hours=24)

    # Approved topics with at least one recently-ingested article
    approved_topics: list[Topic] = (
        db.query(Topic)
        .filter(Topic.status == TopicStatus.approved)
        .filter(sa_exists().where((Article.topic_id == Topic.id) & (Article.ingested_at >= cutoff)))
        .all()
    )

    if not approved_topics:
        logger.info("Daily newsletter: no new approved topics in the last 24 hours")
        return

    subscribers: list[Subscriber] = (
        db.query(Subscriber).filter(Subscriber.is_active == True).all()  # noqa: E712
    )

    logger.info(
        "Daily newsletter: %d topics, %d subscribers",
        len(approved_topics),
        len(subscribers),
    )

    sent = 0
    for subscriber in subscribers:
        matched = assemble_newsletter_topics(subscriber, approved_topics)
        if matched:
            promoted = assemble_promoted_content(subscriber, db)
            if send_daily_newsletter(subscriber, matched, db=db, promoted_content=promoted):
                sent += 1

    logger.info("Daily newsletter: %d emails dispatched", sent)
