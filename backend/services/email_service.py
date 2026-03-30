"""
SendGrid email delivery service.

Public surface:
  send_daily_newsletter(subscriber, topics) -> bool
  run_daily_newsletter(db)               -> None   (called by scheduler)
"""
import logging
from datetime import datetime, timedelta, timezone
from textwrap import dedent

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
<div style="background:#1e293b;border-radius:8px;padding:20px;margin-bottom:16px;">
  <div style="margin-bottom:10px;">
    <span style="background:{badge_bg};color:{badge_fg};font-size:10px;font-weight:700;
                 padding:2px 8px;border-radius:4px;letter-spacing:.05em;
                 text-transform:uppercase;">{domain}</span>
    <span style="color:#64748b;font-size:11px;margin-left:8px;">
      Urgency&nbsp;{urgency}
    </span>
  </div>
  <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#f8fafc;">{name}</h2>
  <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;">{summary}</p>
</div>
"""

_EMAIL_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;">
        <!-- HEADER -->
        <tr>
          <td style="border-bottom:1px solid #1e293b;padding-bottom:20px;
                     margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                      letter-spacing:.1em;text-transform:uppercase;
                      color:#818cf8;">PulseOne Radar</p>
            <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;
                       color:#f8fafc;">Your Weekly Intelligence Briefing</h1>
            <p style="margin:0;font-size:13px;color:#64748b;">
              For {first_name} {last_name} &middot; {date}
              {industry_line}
            </p>
          </td>
        </tr>
        <!-- INTRO -->
        <tr>
          <td style="padding:20px 0 8px;">
            <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;">
              Here are the top technology signals your team needs to know about this week,
              curated by AI and reviewed by PulseOne experts.
            </p>
          </td>
        </tr>
        <!-- TOPICS -->
        <tr>
          <td style="padding:8px 0 24px;">
            {topics_html}
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="border-top:1px solid #1e293b;padding-top:20px;">
            <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
              You&rsquo;re receiving this because you subscribed to PulseOne Radar.<br>
              Domains: {domains_label} &middot; Industry: {industry_label}<br>
              <a href="#" style="color:#818cf8;text-decoration:none;">
                Manage preferences
              </a>
              &nbsp;&middot;&nbsp;
              <a href="#" style="color:#818cf8;text-decoration:none;">
                Unsubscribe
              </a>
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


def _build_html(subscriber: Subscriber, topics: list[Topic]) -> str:
    topic_blocks = []
    for topic in topics:
        color = _DOMAIN_COLORS.get(topic.domain, "#94a3b8")
        topic_blocks.append(
            _TOPIC_BLOCK.format(
                badge_bg=color + "33",  # 20% opacity hex
                badge_fg=color,
                domain=topic.domain,
                urgency=f"{topic.urgency_score:.1f}",
                name=topic.name,
                summary=topic.summary or "No summary available.",
            )
        )

    industry_line = (
        f"&nbsp;&middot;&nbsp;{subscriber.industry}" if subscriber.industry else ""
    )
    return _EMAIL_TEMPLATE.format(
        first_name=subscriber.first_name,
        last_name=subscriber.last_name,
        date=datetime.now(timezone.utc).strftime("%B %-d, %Y"),
        industry_line=industry_line,
        topics_html="\n".join(topic_blocks),
        domains_label=", ".join(subscriber.domains or []) or "All",
        industry_label=subscriber.industry or "Not specified",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_daily_newsletter(subscriber: Subscriber, topics: list[Topic]) -> bool:
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
        f"this week — {datetime.now(timezone.utc).strftime('%b %-d')}"
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
        html_body = _build_html(subscriber, topics)
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
            logger.info(
                "Newsletter sent to %s (%d topics)", subscriber.email, len(topics)
            )
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


def generate_newsletter_preview(db: Session) -> str:
    """
    Build and return a rendered HTML newsletter for a dummy subscriber.

    Uses the 5 most recently approved topics so the preview is always
    populated regardless of the 24-hour recency window used by the real job.
    Does NOT write anything to the database or send any email.
    """
    dummy = Subscriber(
        id=-1,
        email="preview@pulseone.internal",
        first_name="Jane",
        last_name="Executive",
        industry="Technology",
        domains=["AI", "Security", "Cloud"],
        is_active=True,
    )

    topics: list[Topic] = (
        db.query(Topic)
        .filter(Topic.status == TopicStatus.approved)
        .order_by(Topic.urgency_score.desc())
        .limit(5)
        .all()
    )

    if not topics:
        # Return a placeholder so the iframe always shows something useful
        return (
            "<!DOCTYPE html><html><body style='background:#0f172a;"
            "color:#94a3b8;font-family:Arial,sans-serif;padding:40px;'>"
            "<h2>No approved topics yet.</h2>"
            "<p>Approve at least one topic in the Curation Dashboard to see the preview.</p>"
            "</body></html>"
        )

    return _build_html(dummy, topics)


def run_daily_newsletter(db: Session) -> None:
    """
    Fetch all active subscribers, match them to recently-approved topics, and
    dispatch newsletters for those with at least one matching topic.

    "Recently approved" means the topic has at least one article ingested within
    the last 24 hours (used as a proxy for when the topic entered the pipeline).
    """
    from sqlalchemy import exists as sa_exists

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    # Approved topics with at least one recently-ingested article
    approved_topics: list[Topic] = (
        db.query(Topic)
        .filter(Topic.status == TopicStatus.approved)
        .filter(
            sa_exists().where(
                (Article.topic_id == Topic.id) & (Article.ingested_at >= cutoff)
            )
        )
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
            if send_daily_newsletter(subscriber, matched):
                sent += 1

    logger.info("Daily newsletter: %d emails dispatched", sent)
