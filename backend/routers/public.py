import logging
import re
from datetime import UTC, datetime, timedelta
from functools import partial

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models.article import Article, ArticleStatus
from ..models.content import ContentItem
from ..models.domain import Domain
from ..models.newsletter_issue import NewsletterIssue
from ..models.role import Role
from ..models.subscriber import Subscriber, validate_industries_and_role_ids
from ..models.survey_response import SurveyResponse
from ..models.topic import Topic
from ..rate_limits import limiter
from ..services.ai_service import (
    _coerce_synthesis_cards,
    fallback_story_teaser,
    generate_everyone_overview,
    generate_path_synthesis,
)
from ..services.domain_registry import pickable_domains, validate_subscriber_domain_slugs
from ..services.email_service import send_contact_form_notification
from ..services.hubspot_sync import sync_subscriber_to_hubspot
from ..services.newsletter_selection import (
    RECOMMENDED_PATH_ARTICLE_LOOKBACK,
    recommended_path_topic_total_rank,
    resolve_role_names_from_intake,
)
from ..services.recommended_path_card_images import attach_hero_urls
from ..services.recommended_path_process_card_library import (
    is_valid_section_slug,
    lookup_library_row,
)
from ..services.subscriber_tokens import decode_subscriber_preferences_token
from ..services.topic_serializers import domain_public_payload, topic_domain_short
from ..services.tracked_article_filter import article_qualifies_pulse_tracked_surface

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["public"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _validate_subscriber_domains(db: Session, domains: list[str] | None) -> list[str]:
    try:
        return validate_subscriber_domain_slugs(db, list(domains or []))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _clean_required_list(values: list[str] | list[int] | None, label: str) -> list:
    if values is None:
        raise ValueError(f"Select at least one {label}")
    cleaned = [v for v in values if v is not None and (not isinstance(v, str) or v.strip())]
    if not cleaned:
        raise ValueError(f"Select at least one {label}")
    return cleaned


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class DomainPublic(BaseModel):
    slug: str
    label: str
    short_label: str
    color: str


class DomainPublicOut(BaseModel):
    slug: str
    label: str
    short_label: str
    description: str | None = None
    color: str
    sort_order: int
    status: str


class TopicPublic(BaseModel):
    id: int
    name: str
    domain: DomainPublic
    subdomain: str = ""
    summary: str | None
    urgency_score: float
    adoption_state: str
    industry_positions: dict | None = None

    model_config = {"from_attributes": True}


def _serialize_topic_public(topic: Topic) -> TopicPublic:
    return TopicPublic(
        id=topic.id,
        name=topic.name,
        domain=DomainPublic(**domain_public_payload(topic.domain)),
        subdomain=getattr(topic, "subdomain", None) or "",
        summary=topic.summary,
        urgency_score=float(topic.urgency_score or 0.0),
        adoption_state=topic.adoption_state.value
        if hasattr(topic.adoption_state, "value")
        else str(topic.adoption_state),
        industry_positions=topic.industry_positions,
    )


class RolePublic(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    email: str
    first_name: str
    last_name: str
    industries: list[str] | None = None
    domains: list[str] | None = None
    role_ids: list[int] | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v

    @model_validator(mode="after")
    def require_subscription_preferences(self) -> "SubscribeRequest":
        self.role_ids = _clean_required_list(self.role_ids, "title")
        self.industries = _clean_required_list(self.industries, "industry")
        self.domains = _clean_required_list(self.domains, "topic domain")
        return self


class SubscribeResponse(BaseModel):
    id: int
    email: str
    message: str


class ContactRequest(BaseModel):
    """Inbound `/api/contact` payload — backs the form on the public `/contact`
    page. Mirrors the `SubscribeRequest` style (no `EmailStr`; the codebase
    deliberately avoids the `email-validator` dependency)."""

    name: str
    email: str
    company: str
    message: str
    phone: str | None = None
    industry: str | None = None
    role: str | None = None
    # Honeypot — should always come back blank from a real browser. Bots tend
    # to fill every input they see; if this is non-empty we silently 200 and
    # drop the submission (no DB write, no logging beyond a debug line).
    website: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("name", "company", "message")
    @classmethod
    def require_non_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Required field")
        return v

    @field_validator("phone", "industry", "role", "website")
    @classmethod
    def normalise_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class ContactResponse(BaseModel):
    message: str


class SubscriberPreferencesOut(BaseModel):
    email: str
    first_name: str
    last_name: str
    industries: list[str] | None = None
    domains: list[str] | None = None
    role_ids: list[int] | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class SubscriberPreferencesUpdate(BaseModel):
    first_name: str
    last_name: str
    industries: list[str] | None = None
    domains: list[str] | None = None
    role_ids: list[int] | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v

    @model_validator(mode="after")
    def require_subscription_preferences(self) -> "SubscriberPreferencesUpdate":
        self.role_ids = _clean_required_list(self.role_ids, "title")
        self.industries = _clean_required_list(self.industries, "industry")
        self.domains = _clean_required_list(self.domains, "topic domain")
        return self


class RecommendedTopicOut(BaseModel):
    id: int
    name: str
    domain: str
    summary: str | None
    urgency_score: float


class RecommendedContentOut(BaseModel):
    id: str
    title: str
    url: str
    summary: str | None = None
    image_url: str | None = None
    type: str
    tags: list[str]


class ExperienceItem(BaseModel):
    """A single capability-style card under the "Our Experience" section on
    `/recommended-path`. AI-generated per (industry, issue) pair so the cards
    speak to the reader's actual situation."""

    title: str
    description: str
    icon: str = "default"


class EngagementExampleOut(BaseModel):
    """Illustrative project vignette for PulseOne in Action (same intake as synthesis)."""

    id: str
    title: str
    who: str = ""
    provided: str = ""
    approach: str = ""
    solution: str = ""
    how_we_helped: str = ""


class RecommendedWatchStoryOut(BaseModel):
    """Ingested radar story plus a one-line hook tying it to this reader."""

    title: str
    url: str
    hook: str
    radar_topic_name: str
    domain: str
    # RSS / ingest thumbnail (same pool as public radar and newsletter cards)
    image_url: str | None = None


class SynthesisCardOut(BaseModel):
    """Scannable 'What We Think' sub-cards derived from synthesis (titles + bullets)."""

    title: str
    bullets: list[str]
    hero_image_url: str | None = None


class RecommendedPathOut(BaseModel):
    headline: str
    synthesis: str
    synthesis_html: str
    synthesis_cards: list[SynthesisCardOut]
    experience_items: list[ExperienceItem]
    engagement_examples: list[EngagementExampleOut] = []
    topics: list[RecommendedTopicOut]
    content_items: list[RecommendedContentOut]
    watch_brief: str
    watch_posture: str
    watch_stories: list[RecommendedWatchStoryOut]


class RecommendedWatchStoriesOut(BaseModel):
    """Follow-up payload for hydrated Pulse article rows (`defer_articles` on main path)."""

    watch_stories: list[RecommendedWatchStoryOut]


class EveryoneOverviewStats(BaseModel):
    """Live counts shown as badges on the broad-overview hero — keeps the page
    visibly dynamic instead of feeling like a static template."""

    published_topics: int
    distinct_domains: int
    stories_last_24h: int
    last_ingested_at: datetime | None


class EveryoneOverviewOut(BaseModel):
    """No-profile broad executive overview ("Skip — just show me everything").

    Same `headline` / `synthesis_html` shape as `RecommendedPathOut` so the
    frontend can reuse the synthesis-rendering surface without branching."""

    headline: str
    synthesis: str
    synthesis_html: str
    topics: list[RecommendedTopicOut]
    content_items: list[RecommendedContentOut]
    stats: EveryoneOverviewStats


class ArticleTrackedPublic(BaseModel):
    """Ingested story linked to a live radar topic — same article pool the newsletter uses."""

    id: int
    title: str
    url: str
    published_at: datetime | None
    ingested_at: datetime
    domain: str
    source_name: str | None = None
    # Optional thumbnail (RSS media_thumbnail / enclosure / first <img>) — used by
    # the public "Stories we're tracking" cards. Many feeds omit this; the card
    # falls back to a domain-colour gradient so layout stays uniform.
    image_url: str | None = None
    # Short teaser summary: AI-extracted `what_is_it` is preferred (designed for
    # this purpose); raw `content` is a last-resort fallback, truncated server-
    # side so the wire payload stays small and the card layout stays uniform.
    summary: str | None = None

    model_config = {"from_attributes": True}


def _public_article_teaser_summary(a: Article) -> str | None:
    """Pick the cleanest short summary available for a tracked-stories card."""
    if a.what_is_it and a.what_is_it.strip():
        return a.what_is_it.strip()
    if a.content and a.content.strip():
        text = " ".join(a.content.split())
        return text[:240] + "…" if len(text) > 240 else text
    return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/public/domains", response_model=list[DomainPublicOut])
def list_public_domains(db: Session = Depends(get_db)):
    """Pickable domain registry rows for subscribe wizard, preferences, and radar legend."""
    rows = pickable_domains(db)
    return [
        DomainPublicOut(
            slug=d.slug,
            label=d.label,
            short_label=d.short_label,
            description=d.description,
            color=d.color,
            sort_order=d.sort_order,
            status=d.status,
        )
        for d in rows
    ]


@router.get("/roles", response_model=list[RolePublic])
def list_roles_public(db: Session = Depends(get_db)):
    """List subscriber role options for the public subscribe flow (id and name only)."""
    return db.query(Role).order_by(Role.name).all()


@router.get("/topics/published", response_model=list[TopicPublic])
def get_published_topics(db: Session = Depends(get_db)):
    """Return topics marked as published (live on the public Radar)."""
    rows = (
        db.query(Topic)
        .options(joinedload(Topic.domain))
        .filter(Topic.is_published == True)  # noqa: E712
        .order_by(Topic.urgency_score.desc())
        .all()
    )
    return [_serialize_topic_public(t) for t in rows]


@router.get("/articles/tracked", response_model=list[ArticleTrackedPublic])
def list_tracked_articles_public(
    db: Session = Depends(get_db),
    limit: int = Query(default=12, ge=1, le=50),
):
    """Recent articles tied to published topics — underlying sources for radar + daily digest."""
    fetch_cap = min(limit * 8, 200)
    rows = (
        db.query(Article)
        .join(Topic, Article.topic_id == Topic.id)
        .filter(
            Topic.is_published == True,  # noqa: E712
            Article.archived_at.is_(None),
        )
        .options(joinedload(Article.source), joinedload(Article.topic).joinedload(Topic.domain))
        .order_by(Article.ingested_at.desc())
        .limit(fetch_cap)
        .all()
    )
    out: list[ArticleTrackedPublic] = []
    for a in rows:
        if not article_qualifies_pulse_tracked_surface(a):
            continue
        out.append(
            ArticleTrackedPublic(
                id=a.id,
                title=a.title,
                url=a.url,
                published_at=a.published_at,
                ingested_at=a.ingested_at,
                domain=topic_domain_short(a.topic),
                source_name=a.source.name if a.source else None,
                image_url=a.image_url,
                summary=_public_article_teaser_summary(a),
            )
        )
        if len(out) >= limit:
            break
    return out


def _subscriber_from_preferences_token(token: str, db: Session) -> Subscriber:
    try:
        subscriber_id, email = decode_subscriber_preferences_token(token)
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired preferences link") from None
    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber is None or subscriber.email.strip().lower() != email:
        raise HTTPException(status_code=401, detail="Invalid or expired preferences link")
    return subscriber


@router.get("/subscriber/preferences", response_model=SubscriberPreferencesOut)
def get_subscriber_preferences(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Load preferences from a signed newsletter magic link."""
    return _subscriber_from_preferences_token(token, db)


@router.get("/newsletter/issues/{token}", response_class=HTMLResponse)
def read_newsletter_issue(
    token: str,
    db: Session = Depends(get_db),
):
    """Render the exact HTML newsletter issue linked from the email's Read online action."""
    issue = db.query(NewsletterIssue).filter(NewsletterIssue.token == token).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Newsletter issue not found")
    return HTMLResponse(content=issue.html)


@router.put("/subscriber/preferences", response_model=SubscriberPreferencesOut)
def update_subscriber_preferences(
    payload: SubscriberPreferencesUpdate,
    background_tasks: BackgroundTasks,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Update subscriber preferences from a signed newsletter magic link."""
    subscriber = _subscriber_from_preferences_token(token, db)
    inds, rids = validate_industries_and_role_ids(db, payload.industries, payload.role_ids)
    doms = _validate_subscriber_domains(db, payload.domains)
    subscriber.first_name = payload.first_name
    subscriber.last_name = payload.last_name
    subscriber.industries = inds
    subscriber.domains = doms
    subscriber.role_ids = rids
    subscriber.is_active = True
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(
        partial(sync_subscriber_to_hubspot, subscriber, source="preference_update")
    )
    return subscriber


@router.post("/subscriber/unsubscribe", response_model=SubscriberPreferencesOut)
def unsubscribe_subscriber(
    background_tasks: BackgroundTasks,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Deactivate a subscriber from a signed newsletter magic link."""
    subscriber = _subscriber_from_preferences_token(token, db)
    subscriber.is_active = False
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(partial(sync_subscriber_to_hubspot, subscriber, source="unsubscribe"))
    return subscriber


@router.post("/subscribe", response_model=SubscribeResponse, status_code=201)
@limiter.limit("30/minute")
def subscribe(
    request: Request,
    payload: SubscribeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Register a new subscriber with their domain and industry preferences."""
    inds, rids = validate_industries_and_role_ids(db, payload.industries, payload.role_ids)
    doms = _validate_subscriber_domains(db, payload.domains)

    existing = db.query(Subscriber).filter(Subscriber.email == payload.email).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=409, detail="This email is already subscribed")
        # Re-activate lapsed subscriber and update their preferences
        existing.is_active = True
        existing.first_name = payload.first_name
        existing.last_name = payload.last_name
        existing.industries = inds
        existing.domains = doms
        existing.role_ids = rids
        db.commit()
        db.refresh(existing)
        background_tasks.add_task(
            partial(sync_subscriber_to_hubspot, existing, source="subscribe_reactivate")
        )
        return SubscribeResponse(
            id=existing.id, email=existing.email, message="Subscription reactivated"
        )

    subscriber = Subscriber(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        industries=inds,
        domains=doms,
        role_ids=rids,
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(
        partial(sync_subscriber_to_hubspot, subscriber, source="subscribe_signup")
    )
    return SubscribeResponse(
        id=subscriber.id, email=subscriber.email, message="Successfully subscribed"
    )


@router.post("/contact", response_model=ContactResponse, status_code=201)
@limiter.limit("5/minute")
def contact(
    request: Request,
    payload: ContactRequest,
    background_tasks: BackgroundTasks,
):
    """Receive a "Send us a message" submission from the public `/contact` page.

    Sends an email to ``CONTACT_FORM_TO_EMAIL`` (default ``marketing@pulseone.com``)
    via SendGrid when configured. Always logs structured metadata for ops.
    """
    # Honeypot — silently 200 to keep the bot from learning that the field
    # tripped the filter. Log at debug for diagnostics only.
    if payload.website:
        logger.debug(
            "[contact] honeypot tripped from %s — dropping submission silently",
            request.client.host if request.client else "unknown",
        )
        return ContactResponse(message="Thanks — we'll be in touch within one business day.")

    logger.info(
        "[contact] inbound submission",
        extra={
            "contact_name": payload.name,
            "contact_email": payload.email,
            "contact_company": payload.company,
            "contact_phone": payload.phone or "",
            "contact_industry": payload.industry or "",
            "contact_role": payload.role or "",
            "contact_message_chars": len(payload.message),
            "client_ip": request.client.host if request.client else "unknown",
        },
    )

    background_tasks.add_task(
        partial(
            send_contact_form_notification,
            name=payload.name,
            email=payload.email,
            company=payload.company,
            message=payload.message,
            phone=payload.phone,
            industry=payload.industry,
            role=payload.role,
        )
    )

    return ContactResponse(message="Thanks — we'll be in touch within one business day.")


@router.get("/survey", response_class=HTMLResponse)
def record_survey(
    email: str = Query(..., description="Subscriber email"),
    score: int = Query(..., ge=1, le=3, description="1=not relevant, 2=somewhat, 3=highly"),
    date: str = Query(..., description="Newsletter date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Record a newsletter feedback click and return a thank-you page."""
    response = SurveyResponse(
        subscriber_email=email.strip().lower(), score=score, newsletter_date=date
    )
    db.add(response)
    db.commit()
    html = """<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F4F8FA;color:#111827;}
    .card{text-align:center;padding:48px;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08);}
    h1{font-size:24px;margin:0 0 12px;} p{font-size:16px;color:#4A5F6D;margin:0;}
    </style></head><body><div class="card"><h1>Thank you for your feedback!</h1>
    <p>Your response helps us make the briefing more relevant.</p></div></body></html>"""
    return HTMLResponse(content=html)


# Each candidate runs ``recommended_path_topic_total_rank``, which queries recent articles — cap the
# pool so recommended-path avoids ~100+ sequential DB round-trips before the LLM runs.
_RECOMMENDED_PATH_TOPIC_RANK_POOL_CAP = 48
# "Stories on the Pulse for these themes" — UI shows three cards.
_RECOMMENDED_PATH_WATCH_STORIES_LIMIT = 3

ISSUE_DOMAINS: dict[str, list[str]] = {
    "Cybersecurity": ["security"],
    "AI": ["ai"],
    "Compliance": ["compliance", "security"],
    "Cloud": ["cloud"],
    "IT Management": ["cloud", "infrastructure"],
    "Strategy": ["ai", "compliance"],
    "Storage": ["storage"],
    "Infrastructure": ["infrastructure"],
    "Other": [],
}


def _domains_for_intake_issue(issue: str) -> list[str]:
    """
    Map intake issue (wizard enums or loose text) onto radar ``Topic.domain`` values.

    Exact wizard labels use ``ISSUE_DOMAINS``. Free-text (e.g. 'interested in AI') hints domains.
    """
    s = (issue or "").strip()
    if not s:
        return []
    direct = ISSUE_DOMAINS.get(s)
    if direct is not None:
        return list(direct)

    lo = s.lower()
    guessed: list[str] = []

    # Common concerns — substring hints (``?issue=Generative AI`` etc.).
    if any(k in lo for k in ("cyber", "threat", "ransom", "nist", "zerotrust", "zero-trust")):
        guessed.append("security")
    if (
        (
            "llm" in lo
            or "gpt" in lo
            or "genai" in lo
            or "generative ai" in lo
            or "machine learning" in lo
        )
        or lo.strip() == "ai"
        or lo.startswith("ai ")
        or lo.endswith(" ai")
        or " ai " in (" " + lo + " ")
    ):
        guessed.append("ai")
    if any(k in lo for k in ("compliance", "regulation", "hipaa", "sox ", "privacy law")):
        guessed.extend(["compliance", "security"])
    if any(k in lo for k in ("storage", "backup", "nas", "san", "object store")):
        guessed.append("storage")
    if any(k in lo for k in ("cloud", "aws", "azure", "saas")):
        guessed.append("cloud")
    if any(k in lo for k in ("network", "server", "datacenter", "linux", "windows server")):
        guessed.append("infrastructure")
    elif "infrastructure" in lo:
        guessed.append("infrastructure")
    # Microsoft / productivity licensing often appears as its own intake label but maps to Cloud on the radar.
    if any(
        k in lo
        for k in (
            "microsoft",
            "m365",
            "office 365",
            "office365",
            "license",
            "licensing",
            "entra",
            "copilot",
        )
    ):
        guessed.append("cloud")
    if any(k in lo for k in ("leadership", "board", "strategy", "culture")):
        guessed.append("ai")
    seen: set[str] = set()
    out: list[str] = []
    for d in guessed:
        if d not in seen:
            seen.add(d)
            out.append(d)
    return out


def _domains_for_intake(issue: str, stage: str) -> list[str]:
    """
    Extend wizard issue→domain mapping with **stage** hints ("planning for AI",
    "cyber", …) so the radar slice stays anchored to domains the visitor cares about.
    """
    base = list(_domains_for_intake_issue(issue))
    st = (stage or "").lower()
    injections: list[str] = []

    ai_tokens = (
        "gpt",
        "llm",
        "genai",
        "generative",
        "copilot",
        "assistant",
        " machine learning",
    )
    padded = f" {st} "
    if (
        (" ai " in padded)
        or st.strip() == "ai"
        or st.startswith("ai ")
        or any(x in st for x in ai_tokens)
    ):
        injections.append("ai")

    sec_tokens = ("security", "cyber", "ransom", "breach")
    if any(x in st for x in sec_tokens):
        injections.append("security")

    merged: list[str] = []
    seen: set[str] = set()
    for d in injections + base:
        if d and d not in seen:
            seen.add(d)
            merged.append(d)
    return merged


def _article_has_thumbnail(a: Article) -> bool:
    return bool((a.image_url or "").strip())


# Live radar ingest uses ``processed`` on ``is_published`` topics; ``published`` status is often on
# selected-but-not-live topics. Match ``GET /api/articles/tracked`` eligibility, not status alone.
_RECOMMENDED_PATH_WATCH_ARTICLE_STATUSES = (
    ArticleStatus.processed,
    ArticleStatus.published,
)


def _article_eligible_for_watch_story(article: Article) -> bool:
    if article.archived_at is not None:
        return False
    if article.status not in _RECOMMENDED_PATH_WATCH_ARTICLE_STATUSES:
        return False
    return article_qualifies_pulse_tracked_surface(article)


def _newest_article_for_topic(db: Session, topic_id: int, used_ids: set[int]) -> Article | None:
    """Newest ingested article on a topic (thumbnail preferred), same pool as tracked stories."""
    base = db.query(Article).filter(
        Article.topic_id == topic_id,
        Article.status.in_(_RECOMMENDED_PATH_WATCH_ARTICLE_STATUSES),
        Article.archived_at.is_(None),
    )
    if used_ids:
        base = base.filter(Article.id.notin_(used_ids))
    order = (Article.published_at.desc().nullslast(), Article.ingested_at.desc())
    rows = base.order_by(*order).limit(32).all()
    rows.sort(key=_thumb_sort_key_for_watch_pool)
    for hit in rows:
        if _article_eligible_for_watch_story(hit):
            return hit
    return None


def _thumb_sort_key_for_watch_pool(a: Article) -> tuple[int, float]:
    has = 0 if _article_has_thumbnail(a) else 1
    pt = a.published_at
    ts = pt.timestamp() if pt is not None else 0.0
    return (has, -ts)


def _normalize_watch_story_url(url: str) -> str:
    return (url or "").strip().rstrip("/").lower()


def _articles_for_watch_stories(
    db: Session, topics: list[Topic], *, limit: int = _RECOMMENDED_PATH_WATCH_STORIES_LIMIT
) -> list[tuple[Topic, Article]]:
    """Recent ingested Pulse articles on live radar topics, aligned to intake themes.

    Uses the same article pool as ``GET /api/articles/tracked`` (processed + published on
    ``is_published`` topics). Thumbnails are preferred when present.
    """
    if limit < 1 or not topics:
        return []

    topic_ids = [t.id for t in topics]
    topics_by_id: dict[int, Topic] = {t.id: t for t in topics}
    used_ids: set[int] = set()
    used_urls: set[str] = set()
    used_titles: set[str] = set()
    pairs: list[tuple[Topic, Article]] = []

    def _try_append_pair(topic: Topic, hit: Article) -> bool:
        if hit.id in used_ids:
            return False
        url_key = _normalize_watch_story_url(hit.url)
        if url_key and url_key in used_urls:
            return False
        title_key = (hit.title or "").strip().lower()
        if title_key and title_key in used_titles:
            return False
        if not _article_eligible_for_watch_story(hit):
            return False
        used_ids.add(hit.id)
        if url_key:
            used_urls.add(url_key)
        if title_key:
            used_titles.add(title_key)
        pairs.append((topic, hit))
        return True

    # 1) One newest article per intake-aligned topic (thumbnail first when both exist)
    for t in topics:
        if len(pairs) >= limit:
            break
        hit = _newest_article_for_topic(db, t.id, used_ids)
        if hit is None:
            continue
        _try_append_pair(t, hit)

    # 2) Fill from remaining stories on those topics (prefer thumbnails, then recency)
    if len(pairs) < limit:
        need = limit - len(pairs)
        q = db.query(Article).filter(
            Article.topic_id.in_(topic_ids),
            Article.status.in_(_RECOMMENDED_PATH_WATCH_ARTICLE_STATUSES),
            Article.archived_at.is_(None),
        )
        if used_ids:
            q = q.filter(Article.id.notin_(used_ids))
        candidates = (
            q.order_by(Article.published_at.desc().nullslast(), Article.ingested_at.desc())
            .limit(max(need * 8, 24))
            .all()
        )
        candidates.sort(key=_thumb_sort_key_for_watch_pool)
        for hit in candidates:
            if len(pairs) >= limit:
                break
            top = topics_by_id.get(hit.topic_id or 0)
            if top is None:
                continue
            _try_append_pair(top, hit)

    # 3) Last resort: newest on-radar stories (Pulse-wide), thumbnails first
    if len(pairs) < limit:
        need = limit - len(pairs)
        q = (
            db.query(Article)
            .join(Topic, Article.topic_id == Topic.id)
            .options(joinedload(Article.topic))
            .filter(
                Topic.is_published == True,  # noqa: E712
                Article.status.in_(_RECOMMENDED_PATH_WATCH_ARTICLE_STATUSES),
                Article.archived_at.is_(None),
            )
        )
        if used_ids:
            q = q.filter(Article.id.notin_(used_ids))
        candidates = (
            q.order_by(Article.published_at.desc().nullslast(), Article.ingested_at.desc())
            .limit(max(need * 12, 36))
            .all()
        )
        candidates.sort(key=_thumb_sort_key_for_watch_pool)
        for hit in candidates:
            if len(pairs) >= limit:
                break
            top = hit.topic
            if top is None or not top.is_published:
                continue
            _try_append_pair(top, hit)

    return pairs[:limit]


def _recommended_path_require_stage(
    *,
    region: str,
    industry: str,
    role: str,
    issue: str,
    stage: str,
) -> str:
    facets = [
        (region or "").strip(),
        (industry or "").strip(),
        (role or "").strip(),
        (issue or "").strip(),
        (stage or "").strip(),
    ]
    if not any(facets):
        raise HTTPException(
            status_code=400,
            detail="Provide at least one intake field among region, industry, role, issue, stage.",
        )
    return (stage or "").strip()


def _recommended_watch_story_rows(
    watch_pairs: list[tuple[Topic, Article]],
    hooks_list: list[object] | None,
) -> list[RecommendedWatchStoryOut]:
    hooks = hooks_list or []
    rows: list[RecommendedWatchStoryOut] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    hook_idx = 0
    for topic_o, article_o in watch_pairs:
        url_key = _normalize_watch_story_url(article_o.url)
        title_key = (article_o.title or "").strip().lower()
        if url_key and url_key in seen_urls:
            continue
        if title_key and title_key in seen_titles:
            continue
        hook_txt = ""
        if hook_idx < len(hooks) and str(hooks[hook_idx]).strip():
            hook_txt = str(hooks[hook_idx]).strip()
        else:
            hook_txt = fallback_story_teaser(article_o)
        rows.append(
            RecommendedWatchStoryOut(
                title=article_o.title,
                url=article_o.url,
                hook=hook_txt[:720],
                radar_topic_name=topic_o.name,
                domain=topic_domain_short(topic_o),
                image_url=(article_o.image_url or "").strip() or None,
            )
        )
        if url_key:
            seen_urls.add(url_key)
        if title_key:
            seen_titles.add(title_key)
        hook_idx += 1
    return rows


def _watch_stories_payload_for_intake(
    db: Session,
    issue: str,
    industry: str,
    role: str,
    stg: str,
    *,
    hooks_list: list[object] | None,
) -> list[RecommendedWatchStoryOut]:
    topics = _topics_for_recommended(db, issue, industry, role, stg, limit=6)
    pairs = _articles_for_watch_stories(db, topics, limit=_RECOMMENDED_PATH_WATCH_STORIES_LIMIT)
    return _recommended_watch_story_rows(pairs, hooks_list)


def _topics_for_recommended(
    db: Session, issue: str, industry: str, role: str, stage: str, limit: int = 4
) -> list[Topic]:
    """
    Published radar themes aligned to intake **issue domains** + **stage**.
    We avoid cross-domain back-fill (reads as generic). If filtering is sparse,
    widen once to global urgency order so the personalised page still resolves.
    """
    role_names = resolve_role_names_from_intake(role, db)
    now = datetime.now(UTC)
    since = now - RECOMMENDED_PATH_ARTICLE_LOOKBACK

    domains = _domains_for_intake(issue, stage)
    base_q = db.query(Topic).filter(Topic.is_published == True)  # noqa: E712

    scoped_q = base_q
    if domains:
        scoped_q = scoped_q.join(Domain, Topic.domain_id == Domain.id).filter(
            Domain.slug.in_(domains)
        )

    rank_pool = min(max(limit * 28, 36), _RECOMMENDED_PATH_TOPIC_RANK_POOL_CAP)
    candidates = scoped_q.order_by(Topic.urgency_score.desc()).limit(rank_pool).all()

    fallback_pool: list[Topic] = []
    if domains and len(candidates) < limit:
        fallback_pool = base_q.order_by(Topic.urgency_score.desc()).limit(max(limit + 24, 32)).all()

    cand_ids = {c.id for c in candidates}
    pool = candidates + [t for t in fallback_pool if t.id not in cand_ids]

    scored: list[tuple[float, Topic]] = []
    for t in pool:
        score = recommended_path_topic_total_rank(
            db, t, industry=industry, role_names=role_names, since=since, now=now
        )
        scored.append((score, t))

    scored.sort(key=lambda x: -x[0])
    out: list[Topic] = []
    seen: set[int] = set()
    for _, t in scored:
        if t.id in seen:
            continue
        seen.add(t.id)
        out.append(t)
        if len(out) >= limit:
            break
    return out[:limit]


def _content_for_recommended(
    db: Session, industry: str, issue: str, limit: int = 4
) -> list[ContentItem]:
    rows = (
        db.query(ContentItem)
        .filter(ContentItem.is_active == True)  # noqa: E712
        .order_by(ContentItem.created_at.desc())
        .limit(120)
        .all()
    )
    needles = [x.strip() for x in [industry or "", issue or ""] if x.strip()]

    def score(ci: ContentItem) -> float:
        tags = ci.tags or []
        if not isinstance(tags, list):
            return 0.0
        blob = " ".join(str(x) for x in tags).lower()
        s = 0.0
        for n in needles:
            nl = n.lower()
            if nl and nl in blob:
                s += 3.0
            for tag in tags:
                tl = str(tag).lower()
                if nl and (nl in tl or tl in nl):
                    s += 1.0
        return s

    ranked = sorted(rows, key=lambda x: score(x), reverse=True)
    out = ranked[:limit]
    if len(out) < limit:
        for r in rows:
            if r not in out:
                out.append(r)
            if len(out) >= limit:
                break
    return out[:limit]


@router.get("/recommended-path", response_model=RecommendedPathOut)
def recommended_path(
    region: str = Query("", max_length=500),
    industry: str = Query("", max_length=500),
    role: str = Query("", max_length=500),
    issue: str = Query("", max_length=500),
    stage: str = Query("", max_length=8000),
    skip_ai: bool = Query(
        False,
        description="Return deterministic headline, synthesis, and experience cards without calling the LLM (for SSR fallback when the model path is slow or unavailable).",
    ),
    defer_articles: bool = Query(
        False,
        description="Skip loading ingested Pulse story rows server-side so the payload returns faster; use GET /api/recommended-path/watch-stories with the same intake to hydrate.",
    ),
    db: Session = Depends(get_db),
):
    """Personalized headline + synthesis (Claude), matching radar topics, and curated content.

    Any subset of query params may be supplied; at least one non-empty facet is required."""
    stg = _recommended_path_require_stage(
        region=region, industry=industry, role=role, issue=issue, stage=stage
    )
    topics = _topics_for_recommended(db, issue, industry, role, stg, limit=6)
    watch_pairs: list[tuple[Topic, Article]] = []
    if not defer_articles:
        watch_pairs = _articles_for_watch_stories(
            db, topics, limit=_RECOMMENDED_PATH_WATCH_STORIES_LIMIT
        )
    syn = generate_path_synthesis(
        db,
        region,
        industry,
        role,
        issue,
        stage,
        radar_topics=topics,
        radar_story_pairs=watch_pairs,
        skip_llm=skip_ai,
    )
    items = _content_for_recommended(db, industry, issue, limit=4)
    raw_experience = syn.get("experience_items", []) or []
    experience_items = [
        ExperienceItem(
            title=str(e.get("title", "")),
            description=str(e.get("description", "")),
            icon=str(e.get("icon") or "default").strip() or "default",
        )
        for e in raw_experience
        if isinstance(e, dict) and e.get("title") and e.get("description")
    ]
    hooks_raw = syn.get("watch_story_hooks") or []
    hooks_objs: list[object] | None = hooks_raw if isinstance(hooks_raw, list) else None
    watch_stories_out: list[RecommendedWatchStoryOut] = (
        [] if defer_articles else _recommended_watch_story_rows(watch_pairs, hooks_objs)
    )
    raw_cards = syn.get("synthesis_cards") or []
    synthesis_cards_out: list[SynthesisCardOut] = []
    if isinstance(raw_cards, list):
        for row in raw_cards:
            if not isinstance(row, dict):
                continue
            t = str(row.get("title", "")).strip()
            bulls = row.get("bullets")
            if not t or not isinstance(bulls, list):
                continue
            blist = [str(b).strip() for b in bulls if str(b).strip()]
            if len(blist) < 2:
                continue
            synthesis_cards_out.append(SynthesisCardOut(title=t[:200], bullets=blist[:8]))

    if not synthesis_cards_out and str(syn.get("synthesis", "")).strip():
        healed = _coerce_synthesis_cards(
            None,
            str(syn["synthesis"]),
            region=region,
            industry=industry,
            role=role,
            issue=issue,
            stage=stage,
        )
        for row in healed:
            if not isinstance(row, dict):
                continue
            t = str(row.get("title", "")).strip()
            bulls = row.get("bullets")
            if not t or not isinstance(bulls, list):
                continue
            blist = [str(b).strip() for b in bulls if str(b).strip()]
            if len(blist) < 2:
                continue
            synthesis_cards_out.append(SynthesisCardOut(title=t[:200], bullets=blist[:8]))

    heroes = attach_hero_urls(
        db=db,
        cards=[(c.title, list(c.bullets)) for c in synthesis_cards_out],
        region=region,
        industry=industry,
        role=role,
        issue=issue,
        stage=stg,
        skip_ai=skip_ai,
    )
    synthesis_cards_out = [
        card.model_copy(update={"hero_image_url": url})
        for card, url in zip(synthesis_cards_out, heroes, strict=True)
    ]

    raw_engagements = syn.get("engagement_examples") or []
    engagement_examples_out: list[EngagementExampleOut] = []
    if isinstance(raw_engagements, list):
        for row in raw_engagements:
            if not isinstance(row, dict):
                continue
            title = str(row.get("title", "")).strip()
            if not title:
                continue
            eid = str(row.get("id", "")).strip() or "ops-ai-sequencing"
            engagement_examples_out.append(
                EngagementExampleOut(
                    id=eid[:64],
                    title=title[:200],
                    who=str(row.get("who", "")).strip()[:480],
                    provided=str(row.get("provided", "")).strip()[:480],
                    approach=str(row.get("approach", "")).strip()[:1200],
                    solution=str(row.get("solution", "")).strip()[:1200],
                    how_we_helped=str(row.get("how_we_helped", "")).strip()[:1200],
                )
            )

    return RecommendedPathOut(
        headline=str(syn["headline"]),
        synthesis=str(syn["synthesis"]),
        synthesis_html=str(syn.get("synthesis_html", "")),
        synthesis_cards=synthesis_cards_out,
        experience_items=experience_items,
        engagement_examples=engagement_examples_out,
        topics=[
            RecommendedTopicOut(
                id=t.id,
                name=t.name,
                domain=topic_domain_short(t),
                summary=t.summary,
                urgency_score=float(t.urgency_score or 0.0),
            )
            for t in topics
        ],
        watch_brief=str(syn.get("watch_brief", "") or ""),
        watch_posture=str(syn.get("watch_posture", "") or ""),
        watch_stories=watch_stories_out,
        content_items=[
            RecommendedContentOut(
                id=str(ci.id),
                title=ci.title,
                url=ci.url,
                summary=ci.summary,
                image_url=ci.image_url,
                type=ci.type,
                tags=list(ci.tags or []),
            )
            for ci in items
        ],
    )


@router.get("/recommended-path/process-card-images/{industry_slug}/{section_slug}")
def recommended_path_process_card_image(
    industry_slug: str,
    section_slug: str,
    db: Session = Depends(get_db),
):
    """Public binary for pre-rendered ``(industry, section)`` Our Process banners (seeded library)."""
    if not is_valid_section_slug(section_slug):
        raise HTTPException(status_code=404, detail="Not found")
    row = lookup_library_row(
        db,
        industry_slug_value=industry_slug,
        section_slug_value=section_slug,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    etag = f'"{row.industry_slug}-{row.section_slug}-v{row.version}"'
    return Response(
        content=row.image_blob,
        media_type=row.mime_type,
        headers={
            "Cache-Control": "public, max-age=2592000, immutable",
            "ETag": etag,
        },
    )


@router.get("/recommended-path/watch-stories", response_model=RecommendedWatchStoriesOut)
def recommended_path_watch_stories(
    region: str = Query("", max_length=500),
    industry: str = Query("", max_length=500),
    role: str = Query("", max_length=500),
    issue: str = Query("", max_length=500),
    stage: str = Query("", max_length=8000),
    db: Session = Depends(get_db),
):
    """Hydrate ingested Pulse story rows for `/recommended-path` when the main response used ``defer_articles``."""
    stg = _recommended_path_require_stage(
        region=region, industry=industry, role=role, issue=issue, stage=stage
    )
    stories = _watch_stories_payload_for_intake(db, issue, industry, role, stg, hooks_list=None)
    return RecommendedWatchStoriesOut(watch_stories=stories)


@router.get("/everyone-overview", response_model=EveryoneOverviewOut)
def everyone_overview(db: Session = Depends(get_db)):
    """No-profile broad overview powering the `/everyone` ("Skip — just show me
    everything") page. AI synthesis is grounded in live published topics, so
    the page genuinely changes day-to-day with the radar (not just headers
    swapped onto a static template)."""
    syn = generate_everyone_overview(db)

    # Top published topics across ALL domains/industries — broader than
    # `_topics_for_recommended` (which filters to a chosen issue + industry).
    topics = (
        db.query(Topic)
        .options(joinedload(Topic.domain))
        .filter(Topic.is_published == True)  # noqa: E712
        .order_by(Topic.urgency_score.desc())
        .limit(6)
        .all()
    )

    # Recently published, broadly applicable content. We sort newest-first so
    # the page reflects what's been added recently rather than an arbitrary
    # tag-match score (no profile to score against here).
    items = (
        db.query(ContentItem)
        .filter(ContentItem.is_active == True)  # noqa: E712
        .order_by(ContentItem.created_at.desc())
        .limit(6)
        .all()
    )

    # Stats badges — small SQL hits, all aggregate counts, no per-row data.
    published_topics_count = (
        db.query(func.count(Topic.id))
        .filter(Topic.is_published == True)  # noqa: E712
        .scalar()
        or 0
    )
    distinct_domains_count = (
        db.query(func.count(func.distinct(Topic.domain_id)))
        .filter(Topic.is_published == True)  # noqa: E712
        .scalar()
        or 0
    )
    since_24h = datetime.now(UTC) - timedelta(hours=24)
    stories_last_24h_count = (
        db.query(func.count(Article.id))
        .join(Topic, Article.topic_id == Topic.id)
        .filter(Topic.is_published == True)  # noqa: E712
        .filter(Article.ingested_at >= since_24h)
        .scalar()
        or 0
    )
    last_ingested_at = (
        db.query(func.max(Article.ingested_at))
        .join(Topic, Article.topic_id == Topic.id)
        .filter(Topic.is_published == True)  # noqa: E712
        .scalar()
    )

    return EveryoneOverviewOut(
        headline=syn["headline"],
        synthesis=syn["synthesis"],
        synthesis_html=syn.get("synthesis_html", ""),
        topics=[
            RecommendedTopicOut(
                id=t.id,
                name=t.name,
                domain=topic_domain_short(t),
                summary=t.summary,
                urgency_score=float(t.urgency_score or 0.0),
            )
            for t in topics
        ],
        content_items=[
            RecommendedContentOut(
                id=str(ci.id),
                title=ci.title,
                url=ci.url,
                summary=ci.summary,
                image_url=ci.image_url,
                type=ci.type,
                tags=list(ci.tags or []),
            )
            for ci in items
        ],
        stats=EveryoneOverviewStats(
            published_topics=int(published_topics_count),
            distinct_domains=int(distinct_domains_count),
            stories_last_24h=int(stories_last_24h_count),
            last_ingested_at=last_ingested_at,
        ),
    )
