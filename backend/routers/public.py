import logging
import re
from datetime import UTC, datetime, timedelta
from functools import partial

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models.article import Article, ArticleStatus
from ..models.content import ContentItem
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
from ..services.hubspot_sync import sync_subscriber_to_hubspot
from ..services.newsletter_selection import (
    RECOMMENDED_PATH_ARTICLE_LOOKBACK,
    recommended_path_topic_total_rank,
    resolve_role_names_from_intake,
)
from ..services.subscriber_tokens import decode_subscriber_preferences_token
from ..services.tracked_article_filter import article_qualifies_pulse_tracked_surface

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["public"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


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


class TopicPublic(BaseModel):
    id: int
    name: str
    domain: str
    subdomain: str = ""
    summary: str | None
    urgency_score: float
    adoption_state: str
    industry_positions: dict | None = None

    model_config = {"from_attributes": True}


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


class RecommendedWatchStoryOut(BaseModel):
    """Ingested radar story plus a one-line hook tying it to this reader."""

    title: str
    url: str
    hook: str
    radar_topic_name: str
    domain: str


class SynthesisCardOut(BaseModel):
    """Scannable 'What We Think' sub-cards derived from synthesis (titles + bullets)."""

    title: str
    bullets: list[str]


class RecommendedPathOut(BaseModel):
    headline: str
    synthesis: str
    synthesis_html: str
    synthesis_cards: list[SynthesisCardOut]
    experience_items: list[ExperienceItem]
    topics: list[RecommendedTopicOut]
    content_items: list[RecommendedContentOut]
    watch_brief: str
    watch_posture: str
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


@router.get("/roles", response_model=list[RolePublic])
def list_roles_public(db: Session = Depends(get_db)):
    """List subscriber role options for the public subscribe flow (id and name only)."""
    return db.query(Role).order_by(Role.name).all()


@router.get("/topics/published", response_model=list[TopicPublic])
def get_published_topics(db: Session = Depends(get_db)):
    """Return topics marked as published (live on the public Radar)."""
    return (
        db.query(Topic)
        .filter(Topic.is_published == True)  # noqa: E712
        .order_by(Topic.urgency_score.desc())
        .all()
    )


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
        .options(joinedload(Article.source), joinedload(Article.topic))
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
                domain=a.topic.domain if a.topic else "Other",
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
    subscriber.first_name = payload.first_name
    subscriber.last_name = payload.last_name
    subscriber.industries = inds
    subscriber.domains = payload.domains
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

    existing = db.query(Subscriber).filter(Subscriber.email == payload.email).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=409, detail="This email is already subscribed")
        # Re-activate lapsed subscriber and update their preferences
        existing.is_active = True
        existing.first_name = payload.first_name
        existing.last_name = payload.last_name
        existing.industries = inds
        existing.domains = payload.domains
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
        domains=payload.domains,
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
def contact(request: Request, payload: ContactRequest):
    """Receive a "Send us a message" submission from the public `/contact` page.

    MVP behaviour — the submission is structured-logged so an operator (and
    Datadog/CloudWatch downstream) can see every inbound lead. Persistence to a
    `ContactSubmission` table and HubSpot/SendGrid sync should follow the same
    pattern as `/subscribe` → `sync_subscriber_to_hubspot`; a placeholder
    background task is left here so wiring it up is a one-line change later.
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

    # TODO: persist to a `ContactSubmission` table + sync to HubSpot/SendGrid.
    #   `background_tasks.add_task(sync_contact_to_hubspot, payload)` once a
    #   `services/hubspot_sync.py` helper exists for contact-form payloads.

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


ISSUE_DOMAINS: dict[str, list[str]] = {
    "Cybersecurity": ["Security"],
    "AI": ["AI"],
    "Compliance": ["Finance", "Security"],
    "Cloud": ["Cloud"],
    "IT Management": ["Cloud", "Other"],
    "Strategy": ["AI", "Leadership"],
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
        guessed.append("Security")
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
        guessed.append("AI")
    if any(k in lo for k in ("compliance", "regulation", "hipaa", "sox ", "privacy law")):
        guessed.extend(["Finance", "Security"])
    if any(k in lo for k in ("cloud", "aws", "azure", "saas", "infrastructure")):
        guessed.append("Cloud")
    if any(k in lo for k in ("leadership", "board", "strategy", "culture")):
        guessed.append("Leadership")
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
        injections.append("AI")

    sec_tokens = ("security", "cyber", "ransom", "breach")
    if any(x in st for x in sec_tokens):
        injections.append("Security")

    merged: list[str] = []
    seen: set[str] = set()
    for d in injections + base:
        if d and d not in seen:
            seen.add(d)
            merged.append(d)
    return merged


def _articles_for_watch_stories(
    db: Session, topics: list[Topic], *, limit: int = 2
) -> list[tuple[Topic, Article]]:
    """Most recent published articles per prioritized topic."""
    if limit < 1 or not topics:
        return []

    pairs: list[tuple[Topic, Article]] = []
    used_article_ids: set[int] = set()

    for round_idx in range(4):
        for t in topics:
            if len(pairs) >= limit:
                break
            hit = (
                db.query(Article)
                .filter(
                    Article.topic_id == t.id,
                    Article.status == ArticleStatus.published,
                    Article.archived_at.is_(None),
                )
                .order_by(Article.published_at.desc().nullslast(), Article.ingested_at.desc())
                .offset(round_idx)
                .limit(1)
                .first()
            )
            if hit is None or hit.id in used_article_ids:
                continue
            used_article_ids.add(hit.id)
            pairs.append((t, hit))

    return pairs[:limit]


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
        scoped_q = scoped_q.filter(Topic.domain.in_(domains))

    candidates = scoped_q.order_by(Topic.urgency_score.desc()).limit(max(limit * 28, 36)).all()

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
    db: Session = Depends(get_db),
):
    """Personalized headline + synthesis (Claude), matching radar topics, and curated content.

    Any subset of query params may be supplied; at least one non-empty facet is required."""
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
    stg = (stage or "").strip()
    topics = _topics_for_recommended(db, issue, industry, role, stg, limit=4)
    watch_pairs = _articles_for_watch_stories(db, topics, limit=2)
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
    hooks = syn.get("watch_story_hooks") or []
    hooks_list = hooks if isinstance(hooks, list) else []
    watch_stories_out: list[RecommendedWatchStoryOut] = []
    for idx, pair in enumerate(watch_pairs):
        topic_o, article_o = pair
        hook_txt = ""
        if idx < len(hooks_list) and str(hooks_list[idx]).strip():
            hook_txt = str(hooks_list[idx]).strip()
        else:
            hook_txt = fallback_story_teaser(article_o)
        watch_stories_out.append(
            RecommendedWatchStoryOut(
                title=article_o.title,
                url=article_o.url,
                hook=hook_txt[:720],
                radar_topic_name=topic_o.name,
                domain=topic_o.domain,
            )
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
        healed = _coerce_synthesis_cards(None, str(syn["synthesis"]))
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

    return RecommendedPathOut(
        headline=str(syn["headline"]),
        synthesis=str(syn["synthesis"]),
        synthesis_html=str(syn.get("synthesis_html", "")),
        synthesis_cards=synthesis_cards_out,
        experience_items=experience_items,
        topics=[
            RecommendedTopicOut(
                id=t.id,
                name=t.name,
                domain=t.domain,
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
        db.query(func.count(func.distinct(Topic.domain)))
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
                domain=t.domain,
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
