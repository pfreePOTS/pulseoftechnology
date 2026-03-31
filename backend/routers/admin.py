import uuid
from datetime import datetime
from typing import Any

import jwt
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Security,
    status,
)
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session, joinedload

from ..config import settings as app_settings
from ..database import SessionLocal, get_db
from ..dependencies import (
    ADMIN_COOKIE_NAME,
    create_admin_access_token,
    decode_admin_token,
    get_token_from_request,
    require_admin,
    verify_admin_password,
)
from ..models.article import Article
from ..models.content import ContentItem
from ..models.role import Role
from ..models.signal import SignalRecommendation
from ..models.source import Source, SourceType
from ..models.subscriber import Subscriber
from ..models.topic import AdoptionState, Topic, TopicStatus
from ..rate_limits import limiter
from ..services.ai_service import suggest_industry_positions, suggest_topic_persona_by_role
from ..services.email_service import generate_newsletter_preview, run_daily_newsletter
from ..services.hubspot_sync import sync_subscriber_to_hubspot
from ..services.ingestion import run_all_sources, run_article_processing_pipeline

_bearer_optional = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest) -> JSONResponse:
    """Issue a JWT and set an httpOnly cookie for browser clients."""
    if not verify_admin_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    token = create_admin_access_token()
    secure = app_settings.environment in ("production", "staging")
    response = JSONResponse(
        {"access_token": token, "token_type": "bearer"},
    )
    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=app_settings.admin_token_expire_minutes * 60,
        samesite="lax",
        path="/",
        secure=secure,
    )
    return response


@router.post("/logout")
def logout() -> JSONResponse:
    """Clear admin session cookie."""
    response = JSONResponse({"ok": True})
    response.delete_cookie(key=ADMIN_COOKIE_NAME, path="/")
    return response


@router.get("/session")
def admin_session(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_optional),
) -> dict:
    """Return whether a valid JWT is present (cookie or Bearer)."""
    token = get_token_from_request(request, credentials)
    if not token:
        return {"authenticated": False}
    try:
        decode_admin_token(token)
        return {"authenticated": True}
    except jwt.PyJWTError:
        return {"authenticated": False}


# ---------------------------------------------------------------------------
# Articles (raw firehose)
# ---------------------------------------------------------------------------


class ArticleListItem(BaseModel):
    id: int
    source_id: int
    source_name: str | None = None
    topic_id: int | None
    topic_name: str | None = None
    title: str
    url: str
    published_at: datetime | None
    ingested_at: datetime
    status: str

    model_config = {"from_attributes": True}


@router.get("/articles", response_model=list[ArticleListItem])
def list_articles(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
    article_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Return raw articles ordered by published_at descending. Optional status filter (comma-separated)."""
    q = db.query(Article).options(
        joinedload(Article.source), joinedload(Article.topic)
    )
    if article_status:
        statuses = [s.strip() for s in article_status.split(",") if s.strip()]
        if statuses:
            q = q.filter(Article.status.in_(statuses))
    q = q.order_by(Article.published_at.desc().nullslast(), Article.id.desc())
    rows = q.offset(offset).limit(limit).all()
    return [
        ArticleListItem(
            id=a.id,
            source_id=a.source_id,
            source_name=a.source.name if a.source else None,
            topic_id=a.topic_id,
            topic_name=a.topic.name if a.topic else None,
            title=a.title,
            url=a.url,
            published_at=a.published_at,
            ingested_at=a.ingested_at,
            status=a.status.value if hasattr(a.status, "value") else str(a.status),
        )
        for a in rows
    ]


# ---------------------------------------------------------------------------
# Topics
# ---------------------------------------------------------------------------


class ArticleOut(BaseModel):
    id: int
    title: str
    url: str
    content: str | None
    status: str
    subdomain: str = ""
    what_is_it: str | None = None
    why_it_matters: str | None = None
    persona_impacts: dict[str, str] | None = None
    tags: list[str] | None = None
    published_at: datetime | None = None
    source_name: str | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def article_from_orm(cls, data: Any) -> Any:
        if isinstance(data, Article):
            src = getattr(data, "source", None)
            return {
                "id": data.id,
                "title": data.title,
                "url": data.url,
                "content": data.content,
                "status": data.status.value if hasattr(data.status, "value") else str(data.status),
                "subdomain": getattr(data, "subdomain", None) or "",
                "what_is_it": data.what_is_it,
                "why_it_matters": data.why_it_matters,
                "persona_impacts": data.persona_impacts,
                "tags": data.tags,
                "published_at": data.published_at,
                "source_name": src.name if src is not None else None,
            }
        return data


class TopicOut(BaseModel):
    id: int
    name: str
    domain: str
    subdomain: str = ""
    summary: str | None
    urgency_score: float
    status: str
    adoption_state: str
    industry_positions: dict | None = None
    persona_by_role: dict[str, str] | None = None
    article_count: int = 0
    is_published: bool = False
    velocity_score: float | None = None
    acceleration_score: float | None = None
    signal_rationale: str | None = None
    signal_suggested_action: str | None = None
    signal_id: int | None = None

    model_config = {"from_attributes": True}


class TopicDetail(TopicOut):
    articles: list[ArticleOut]


class TopicPositioningInsight(BaseModel):
    topic_id: int
    name: str
    domain: str
    urgency_score: float
    article_count: int
    articles_last_7d: int = Field(description="Articles ingested in the last 7 days")
    articles_prior_7d: int = Field(description="Articles ingested in the 7 days before that")
    trend: str = Field(description="up | down | flat")
    label: str
    note: str
    ai_enriched: bool


class TopicUpdate(BaseModel):
    summary: str | None = None
    urgency_score: float | None = None
    adoption_state: AdoptionState | None = None
    industry_positions: dict | None = None
    persona_by_role: dict[str, str] | None = None
    subdomain: str | None = None


@router.get("/topics", response_model=list[TopicOut])
def list_topics(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
    topic_status: TopicStatus | None = Query(default=None, alias="status"),
    is_published: bool | None = Query(default=None),
):
    from sqlalchemy import func
    from sqlalchemy.orm import aliased

    from ..services.signal_service import compute_topic_velocity_metrics

    q = db.query(Topic)
    if topic_status is not None:
        q = q.filter(Topic.status == topic_status)
    if is_published is not None:
        q = q.filter(Topic.is_published == is_published)
    topics = q.order_by(Topic.urgency_score.desc()).all()

    topic_ids = [t.id for t in topics]
    if not topic_ids:
        return []

    # Subquery: latest signal per topic (by created_at desc)
    latest_sq = (
        db.query(
            SignalRecommendation.topic_id,
            func.max(SignalRecommendation.id).label("max_id"),
        )
        .filter(SignalRecommendation.topic_id.in_(topic_ids))
        .group_by(SignalRecommendation.topic_id)
        .subquery()
    )
    SigAlias = aliased(SignalRecommendation)
    signal_rows = (
        db.query(SigAlias)
        .join(latest_sq, SigAlias.id == latest_sq.c.max_id)
        .all()
    )
    sig_map: dict[int, SignalRecommendation] = {s.topic_id: s for s in signal_rows}

    result = []
    for t in topics:
        sig = sig_map.get(t.id)
        vel, accel = compute_topic_velocity_metrics(t.id, db)
        result.append(
            TopicOut(
                id=t.id,
                name=t.name,
                domain=t.domain,
                subdomain=getattr(t, "subdomain", None) or "",
                summary=t.summary,
                urgency_score=t.urgency_score,
                status=t.status.value,
                adoption_state=t.adoption_state.value if hasattr(t.adoption_state, "value") else str(t.adoption_state),
                industry_positions=t.industry_positions,
                persona_by_role=t.persona_by_role,
                article_count=t.article_count,
                is_published=t.is_published,
                velocity_score=vel,
                acceleration_score=accel,
                signal_rationale=sig.rationale if sig else None,
                signal_suggested_action=sig.suggested_action if sig else None,
                signal_id=sig.id if sig else None,
            )
        )
    return result


@router.get("/topics/positioning-insights", response_model=list[TopicPositioningInsight])
def topic_positioning_insights(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Article velocity (7d vs prior 7d) plus optional Haiku synthesis for the Positioning workbench."""
    from ..services.trend_service import build_positioning_insights

    return build_positioning_insights(db, status=TopicStatus.selected)


@router.get("/topics/{topic_id}", response_model=TopicDetail)
def get_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    topic = (
        db.query(Topic)
        .options(joinedload(Topic.articles).joinedload(Article.source))
        .filter(Topic.id == topic_id)
        .first()
    )
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.put("/topics/{topic_id}", response_model=TopicOut)
def update_topic(
    topic_id: int,
    payload: TopicUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    if payload.summary is not None:
        topic.summary = payload.summary
    if payload.urgency_score is not None:
        topic.urgency_score = payload.urgency_score
    if payload.adoption_state is not None:
        topic.adoption_state = payload.adoption_state
    if payload.industry_positions is not None:
        topic.industry_positions = payload.industry_positions
    if payload.subdomain is not None:
        topic.subdomain = payload.subdomain.strip()

    patch = payload.model_dump(exclude_unset=True)
    if "persona_by_role" in patch:
        topic.persona_by_role = patch["persona_by_role"]

    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/suggest-industry-positions")
def suggest_positions(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Ask Claude to suggest per-industry impact, risk, adoption state, and rationales."""
    try:
        result = suggest_industry_positions(topic_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.post("/topics/{topic_id}/suggest-persona-by-role")
def suggest_persona_by_role(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Ask Claude to synthesize topic-level persona lines per Role (Analysis Persona tab)."""
    try:
        return suggest_topic_persona_by_role(topic_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/topics/{topic_id}/trend-analysis")
def run_topic_trend_analysis(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Run the Claude Haiku trend agent for this topic: fills pending SignalRecommendation
    with watch | radar | remove + rationale (velocity/acceleration from article counts).
    """
    from ..services.signal_service import upsert_pending_trend_signal

    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status not in (
        TopicStatus.pending,
        TopicStatus.watched,
        TopicStatus.selected,
    ):
        raise HTTPException(status_code=400, detail="Trend analysis is not available for this topic status")

    row = upsert_pending_trend_signal(topic_id, db)
    if row is None:
        raise HTTPException(status_code=502, detail="AI trend analysis failed")
    return {
        "topic_id": topic_id,
        "signal_id": row.id,
        "velocity_score": row.velocity_score,
        "acceleration_score": row.acceleration_score,
        "suggested_action": row.suggested_action,
        "rationale": row.rationale,
    }


@router.post("/topics/{topic_id}/watch", response_model=TopicOut)
def watch_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Promote a pending topic to 'watched' (tracking for research)."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status != TopicStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending topics can be watched")
    topic.status = TopicStatus.watched
    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/select", response_model=TopicOut)
def select_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Select a watched topic for the radar pipeline."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status not in (TopicStatus.watched, TopicStatus.selected):
        raise HTTPException(status_code=409, detail="Only watched topics can be selected")
    topic.status = TopicStatus.selected
    db.query(Article).filter(Article.topic_id == topic_id).update(
        {"status": "published"}, synchronize_session=False
    )
    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/deselect", response_model=TopicOut)
def deselect_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Move a selected topic back to watched."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status != TopicStatus.selected:
        raise HTTPException(status_code=409, detail="Only selected topics can be deselected")
    topic.status = TopicStatus.watched
    topic.is_published = False
    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/approve", response_model=TopicOut)
def approve_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Approve a pending/watched topic (→ selected) and accept the latest pending signal if any."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status == TopicStatus.selected:
        raise HTTPException(status_code=409, detail="Topic is already approved")

    # Accept the latest pending signal for this topic (if any)
    latest_signal = (
        db.query(SignalRecommendation)
        .filter(
            SignalRecommendation.topic_id == topic_id,
            SignalRecommendation.status == "pending",
        )
        .order_by(SignalRecommendation.created_at.desc())
        .first()
    )
    try:
        if latest_signal:
            # Adoption state is set in Analysis (per-industry), not from trend signals
            latest_signal.status = "approved"

        topic.status = TopicStatus.selected
        db.query(Article).filter(Article.topic_id == topic_id).update(
            {"status": "published"}, synchronize_session=False
        )
        db.commit()
        db.refresh(topic)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    return topic


@router.post("/topics/{topic_id}/publish", response_model=TopicOut)
def publish_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status != TopicStatus.selected:
        raise HTTPException(status_code=400, detail="Topic must be selected before publishing")
    topic.is_published = True
    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/unpublish", response_model=TopicOut)
def unpublish_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic.is_published = False
    db.commit()
    db.refresh(topic)
    return topic


# ---------------------------------------------------------------------------
# Topic Executive Summary Generation
# ---------------------------------------------------------------------------


@router.post("/topics/{topic_id}/generate-summary", response_model=TopicOut)
def generate_topic_summary_endpoint(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    from ..services.ai_service import generate_topic_summary  # avoid circular at module level

    topic = db.query(Topic).options(joinedload(Topic.articles)).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    articles = topic.articles
    generate_topic_summary(topic, list(articles))
    db.commit()
    db.refresh(topic)
    return topic


# ---------------------------------------------------------------------------
# Topic Merge
# ---------------------------------------------------------------------------


class TopicMergeRequest(BaseModel):
    source_topic_ids: list[int]
    target_topic_id: int


@router.post("/topics/merge", status_code=200)
def merge_topics(
    payload: TopicMergeRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Merge one or more source topics into a target topic.
    All articles from source topics are reassigned to the target.
    Source topics are deleted. Target urgency is set to the max across all merged topics.
    """
    if payload.target_topic_id in payload.source_topic_ids:
        raise HTTPException(status_code=400, detail="Target topic cannot also be a source topic")

    target = db.query(Topic).filter(Topic.id == payload.target_topic_id).first()
    if target is None:
        raise HTTPException(status_code=404, detail="Target topic not found")

    sources = db.query(Topic).filter(Topic.id.in_(payload.source_topic_ids)).all()
    if len(sources) != len(payload.source_topic_ids):
        raise HTTPException(status_code=404, detail="One or more source topics not found")

    # Reassign articles and track max urgency
    max_urgency = target.urgency_score
    for src in sources:
        if src.urgency_score > max_urgency:
            max_urgency = src.urgency_score
        db.query(Article).filter(Article.topic_id == src.id).update(
            {"topic_id": payload.target_topic_id}, synchronize_session=False
        )
        # Reassign any pending signals
        db.query(SignalRecommendation).filter(SignalRecommendation.topic_id == src.id).update(
            {"topic_id": payload.target_topic_id}, synchronize_session=False
        )
        db.delete(src)

    target.urgency_score = max_urgency
    db.commit()
    db.refresh(target)
    return {"merged_into": payload.target_topic_id, "deleted": payload.source_topic_ids}


# ---------------------------------------------------------------------------
# Signal Recommendations
# ---------------------------------------------------------------------------


class SignalOut(BaseModel):
    id: int
    topic_id: int
    topic_name: str
    topic_domain: str
    current_state: str
    suggested_state: str
    suggested_action: str = "watch"
    rationale: str
    velocity_score: float
    acceleration_score: float
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/signals", response_model=list[SignalOut])
def list_signals(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
    status: str = Query(default="pending"),
):
    rows = (
        db.query(SignalRecommendation)
        .filter(SignalRecommendation.status == status)
        .order_by(SignalRecommendation.created_at.desc())
        .all()
    )
    result = []
    for row in rows:
        topic = db.query(Topic).filter(Topic.id == row.topic_id).first()
        result.append(
            SignalOut(
                id=row.id,
                topic_id=row.topic_id,
                topic_name=topic.name if topic else "(deleted)",
                topic_domain=topic.domain if topic else "",
                current_state=topic.adoption_state if topic else "",
                suggested_state=row.suggested_state,
                suggested_action=row.suggested_action,
                rationale=row.rationale,
                velocity_score=row.velocity_score,
                acceleration_score=row.acceleration_score,
                status=row.status,
                created_at=row.created_at,
            )
        )
    return result


@router.post("/signals/{signal_id}/approve", response_model=SignalOut)
def approve_signal(
    signal_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    signal = db.query(SignalRecommendation).filter(SignalRecommendation.id == signal_id).first()
    if signal is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    signal.status = "approved"
    db.commit()
    topic = db.query(Topic).filter(Topic.id == signal.topic_id).first()
    db.refresh(signal)
    return SignalOut(
        id=signal.id,
        topic_id=signal.topic_id,
        topic_name=topic.name if topic else "(deleted)",
        topic_domain=topic.domain if topic else "",
        current_state=topic.adoption_state if topic else "",
        suggested_state=signal.suggested_state,
        suggested_action=signal.suggested_action,
        rationale=signal.rationale,
        velocity_score=signal.velocity_score,
        acceleration_score=signal.acceleration_score,
        status=signal.status,
        created_at=signal.created_at,
    )


@router.post("/signals/{signal_id}/reject")
def reject_signal(
    signal_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    signal = db.query(SignalRecommendation).filter(SignalRecommendation.id == signal_id).first()
    if signal is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    signal.status = "rejected"
    db.commit()
    return {"status": "rejected"}


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------


class SourceOut(BaseModel):
    id: int
    name: str
    url: str
    type: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SourceCreate(BaseModel):
    name: str
    url: str
    type: str = "rss"


class SourceUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


@router.get("/sources", response_model=list[SourceOut])
def list_sources(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    return db.query(Source).order_by(Source.name).all()


@router.post("/sources", response_model=SourceOut, status_code=201)
def create_source(
    payload: SourceCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    if db.query(Source).filter(Source.url == payload.url).first():
        raise HTTPException(status_code=409, detail="A source with this URL already exists")
    try:
        src_type = SourceType(payload.type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid source type: {payload.type!r}")
    source = Source(name=payload.name, url=payload.url, type=src_type)
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.put("/sources/{source_id}", response_model=SourceOut)
def update_source(
    source_id: int,
    payload: SourceUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    source = db.query(Source).filter(Source.id == source_id).first()
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    if payload.name is not None:
        source.name = payload.name
    if payload.is_active is not None:
        source.is_active = payload.is_active
    db.commit()
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    source = db.query(Source).filter(Source.id == source_id).first()
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()


# ---------------------------------------------------------------------------
# Subscribers
# ---------------------------------------------------------------------------


class SubscriberOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    industry: str | None
    domains: list[str] | None
    role_id: int | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/subscribers", response_model=list[SubscriberOut])
def list_subscribers(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    return db.query(Subscriber).order_by(Subscriber.created_at.desc()).all()


class SubscriberRoleUpdate(BaseModel):
    role_id: int | None = None


@router.put("/subscribers/{subscriber_id}/role", response_model=SubscriberOut)
def update_subscriber_role(
    subscriber_id: int,
    payload: SubscriberRoleUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    if payload.role_id is not None:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if role is None:
            raise HTTPException(status_code=404, detail="Role not found")
    subscriber.role_id = payload.role_id
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(sync_subscriber_to_hubspot, subscriber)
    return subscriber


# ---------------------------------------------------------------------------
# Roles
# ---------------------------------------------------------------------------


class RoleOut(BaseModel):
    id: int
    name: str
    tags: list[str] | None = None

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str
    tags: list[str] | None = None


class RoleUpdate(BaseModel):
    name: str | None = None
    tags: list[str] | None = None


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    return db.query(Role).order_by(Role.name).all()


@router.post("/roles", response_model=RoleOut, status_code=201)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    if db.query(Role).filter(Role.name == payload.name).first():
        raise HTTPException(status_code=409, detail="A role with this name already exists")
    role = Role(name=payload.name, tags=payload.tags)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    if payload.name is not None:
        role.name = payload.name
    if payload.tags is not None:
        role.tags = payload.tags
    db.commit()
    db.refresh(role)
    return role


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()


# ---------------------------------------------------------------------------
# Content Library
# ---------------------------------------------------------------------------

CONTENT_TYPES = {"article", "video", "landing_page"}


class ContentItemOut(BaseModel):
    id: uuid.UUID
    title: str
    url: str
    type: str
    summary: str | None = None
    tags: list[str] = []
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentItemCreate(BaseModel):
    title: str
    url: str
    type: str
    summary: str | None = None
    tags: list[str] = []


class ContentItemUpdate(BaseModel):
    title: str | None = None
    url: str | None = None
    type: str | None = None
    summary: str | None = None
    tags: list[str] | None = None
    is_active: bool | None = None


@router.get("/content", response_model=list[ContentItemOut])
def list_content(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    return db.query(ContentItem).order_by(ContentItem.created_at.desc()).all()


@router.post("/content", response_model=ContentItemOut, status_code=201)
def create_content(
    payload: ContentItemCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    if payload.type not in CONTENT_TYPES:
        raise HTTPException(status_code=422, detail=f"type must be one of {sorted(CONTENT_TYPES)}")
    item = ContentItem(
        title=payload.title,
        url=payload.url,
        type=payload.type,
        summary=payload.summary,
        tags=payload.tags,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/content/{item_id}", response_model=ContentItemOut)
def update_content(
    item_id: uuid.UUID,
    payload: ContentItemUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Content item not found")
    if payload.title is not None:
        item.title = payload.title
    if payload.url is not None:
        item.url = payload.url
    if payload.type is not None:
        if payload.type not in CONTENT_TYPES:
            raise HTTPException(
                status_code=422, detail=f"type must be one of {sorted(CONTENT_TYPES)}"
            )
        item.type = payload.type
    if payload.summary is not None:
        item.summary = payload.summary
    if payload.tags is not None:
        item.tags = payload.tags
    if payload.is_active is not None:
        item.is_active = payload.is_active
    db.commit()
    db.refresh(item)
    return item


@router.delete("/content/{item_id}", status_code=204)
def delete_content(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Content item not found")
    db.delete(item)
    db.commit()


# ---------------------------------------------------------------------------
# Newsletter preview
# ---------------------------------------------------------------------------


@router.get("/newsletter/preview", response_class=HTMLResponse)
def newsletter_preview(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
    industry: str | None = Query(default=None),
    domains: list[str] = Query(default=[]),
    role_id: int | None = Query(default=None),
):
    """Return a fully rendered HTML newsletter for a simulated subscriber profile."""
    return HTMLResponse(
        content=generate_newsletter_preview(
            db,
            industry=industry or None,
            domains=domains or None,
            role_id=role_id,
        )
    )


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


def _run_ingest() -> None:
    db = SessionLocal()
    try:
        run_all_sources(db)
    finally:
        db.close()


def _run_process_raw() -> None:
    db = SessionLocal()
    try:
        run_article_processing_pipeline(db)
    finally:
        db.close()


def _run_newsletter() -> None:
    db = SessionLocal()
    try:
        run_daily_newsletter(db)
    finally:
        db.close()


@router.post("/jobs/ingest")
def trigger_ingest(
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
):
    background_tasks.add_task(_run_ingest)
    return {"message": "RSS ingestion started in the background."}


@router.post("/jobs/process")
def trigger_process_raw(
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
):
    """Run AI classification + embeddings on existing raw articles (no RSS fetch)."""
    background_tasks.add_task(_run_process_raw)
    return {"message": "Raw article processing started in the background."}


@router.post("/jobs/newsletter")
def trigger_newsletter(
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
):
    background_tasks.add_task(_run_newsletter)
    return {"message": "Newsletter dispatch started in the background."}


def _run_signals() -> None:
    from ..services.signal_service import cleanup_empty_topics, run_signal_scorer

    db = SessionLocal()
    try:
        cleanup_empty_topics(db)
        run_signal_scorer(db)
    finally:
        db.close()


@router.post("/jobs/signals")
def trigger_signals(
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
):
    background_tasks.add_task(_run_signals)
    return {"message": "Signal scoring started in the background."}


def _run_trend_analysis_all() -> None:
    import logging

    from ..services.signal_service import upsert_pending_trend_signal

    log = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        queue = (
            db.query(Topic)
            .filter(Topic.status.in_([TopicStatus.pending, TopicStatus.watched]))
            .all()
        )
        ok = 0
        for t in queue:
            try:
                if upsert_pending_trend_signal(t.id, db):
                    ok += 1
            except Exception:
                log.exception("trend-analysis failed for topic %d", t.id)
        log.info("Bulk trend analysis: %d / %d topics processed", ok, len(queue))
    finally:
        db.close()


@router.post("/jobs/trend-analysis")
def trigger_trend_analysis(
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
):
    """Run the AI trend-pick agent for every pending and watching topic (background)."""
    background_tasks.add_task(_run_trend_analysis_all)
    return {"message": "AI trend analysis started for all pending topics."}
