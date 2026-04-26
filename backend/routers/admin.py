import logging
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

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
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session, joinedload

from ..admin_permissions import INVITABLE_PAGE_SLUGS, normalize_login_email
from ..config import settings as app_settings
from ..database import SessionLocal, get_db
from ..dependencies import (
    ADMIN_COOKIE_NAME,
    create_admin_access_token,
    get_admin_user_from_token,
    get_token_from_request,
    hash_password,
    require_admin,
    require_superuser,
    verify_password,
)
from ..models.admin_user import AdminUser
from ..models.agent_run import AgentRun
from ..models.article import Article
from ..models.content import ContentItem
from ..models.prompt import PromptProposal, PromptTemplate
from ..models.role import Role
from ..models.signal import SignalRecommendation
from ..models.source import Source, SourceType
from ..models.subscriber import Subscriber, validate_industries_and_role_ids
from ..models.survey_response import SurveyResponse
from ..models.topic import AdoptionState, Topic, TopicStatus
from ..rate_limits import limiter
from ..services.ai_service import (
    INDUSTRY_GRID_LABELS,
    clear_prompt_template_cache,
    ensure_topic_industry_grid_complete,
    suggest_industry_positions,
    suggest_subdomain_for_topic,
    suggest_topic_persona_by_role,
)
from ..services.email_service import (
    generate_newsletter_preview,
    run_daily_newsletter,
    send_admin_invite_email,
    send_test_newsletter,
)
from ..services.hubspot_sync import sync_subscriber_to_hubspot
from ..services.ingestion import run_all_sources, run_article_processing_pipeline
from ..services.pipeline_settings import (
    merge_pipeline_settings,
    merged_settings_public_dict,
    upsert_site_config,
)

logger = logging.getLogger(__name__)

_SUBSCRIBER_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

_bearer_optional = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: str
    password: str


def _issue_admin_cookie_response(user: AdminUser) -> JSONResponse:
    token = create_admin_access_token(user)
    secure = app_settings.environment in ("production", "staging")
    response = JSONResponse(
        {
            "access_token": token,
            "token_type": "bearer",
            "must_change_password": user.must_change_password,
        },
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


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> JSONResponse:
    """Issue a JWT and set an httpOnly cookie for browser clients."""
    email = normalize_login_email(payload.email)
    user = db.query(AdminUser).filter(AdminUser.email == email).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return _issue_admin_cookie_response(user)


@router.post("/logout")
def logout() -> JSONResponse:
    """Clear admin session cookie."""
    response = JSONResponse({"ok": True})
    response.delete_cookie(key=ADMIN_COOKIE_NAME, path="/")
    return response


@router.get("/session")
def admin_session(
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_optional),
) -> dict:
    """Return session and current user when a valid JWT is present (cookie or Bearer)."""
    token = get_token_from_request(request, credentials)
    if not token:
        return {"authenticated": False}
    try:
        user = get_admin_user_from_token(token, db)
    except HTTPException:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "is_superuser": user.is_superuser,
            "must_change_password": user.must_change_password,
            "page_permissions": user.page_permissions or [],
        },
    }


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=256)


@router.post("/me/password")
def change_own_password(
    payload: ChangePasswordBody,
    user: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Change password for the authenticated user (required after invite)."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.add(user)
    db.commit()
    return {"ok": True}


class AdminUserOut(BaseModel):
    id: int
    email: str
    is_superuser: bool
    is_active: bool
    must_change_password: bool
    page_permissions: list[str]

    model_config = {"from_attributes": True}


@router.get("/me", response_model=AdminUserOut)
def admin_me(user: AdminUser = Depends(require_admin)) -> AdminUser:
    return user


class InviteUserBody(BaseModel):
    email: str
    page_permissions: list[str] = Field(default_factory=list)
    send_email: bool = True


class PatchAdminUserBody(BaseModel):
    page_permissions: list[str] | None = None
    is_active: bool | None = None


def _validate_invite_permissions(slugs: list[str]) -> None:
    bad = sorted([s for s in slugs if s not in INVITABLE_PAGE_SLUGS])
    if bad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid page permissions: {bad}",
        )


@router.get("/users", response_model=list[AdminUserOut])
def list_admin_users(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_superuser),
) -> list[AdminUser]:
    return db.query(AdminUser).order_by(AdminUser.email).all()


@router.post("/users/invite")
def invite_admin_user(
    payload: InviteUserBody,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_superuser),
) -> dict:
    _validate_invite_permissions(payload.page_permissions)
    if not payload.page_permissions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one page this user can access",
        )
    email = normalize_login_email(payload.email)
    if "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="A valid email address is required"
        )
    if db.query(AdminUser).filter(AdminUser.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    temp = secrets.token_urlsafe(14)
    user = AdminUser(
        email=email,
        password_hash=hash_password(temp),
        is_superuser=False,
        is_active=True,
        must_change_password=True,
        page_permissions=list(payload.page_permissions),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    login_url = f"{app_settings.public_site_url.rstrip('/')}/admin/login"
    emailed = False
    if payload.send_email:
        emailed = send_admin_invite_email(email, temp, login_url)
    return {
        "id": user.id,
        "email": user.email,
        "temporary_password": temp,
        "email_sent": emailed,
    }


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def patch_admin_user(
    user_id: int,
    payload: PatchAdminUserBody,
    db: Session = Depends(get_db),
    actor: AdminUser = Depends(require_superuser),
) -> AdminUser:
    u = db.get(AdminUser, user_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if u.is_superuser and (payload.is_active is False or payload.page_permissions is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot modify superuser access"
        )
    if payload.page_permissions is not None:
        _validate_invite_permissions(payload.page_permissions)
        u.page_permissions = list(payload.page_permissions)
    if payload.is_active is not None:
        if actor.id == user_id and not payload.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate yourself"
            )
        u.is_active = payload.is_active
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/users/{user_id}")
def delete_admin_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: AdminUser = Depends(require_superuser),
) -> dict:
    if actor.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account"
        )
    u = db.get(AdminUser, user_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if u.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete a superuser account"
        )
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/reset-password")
def reset_admin_user_password(
    user_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_superuser),
) -> dict:
    u = db.get(AdminUser, user_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    temp = secrets.token_urlsafe(14)
    u.password_hash = hash_password(temp)
    u.must_change_password = True
    db.add(u)
    db.commit()
    return {"temporary_password": temp}


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
    archived_at: datetime | None = None

    model_config = {"from_attributes": True}


class ArticleStatsOut(BaseModel):
    active: int
    archived: int


class PipelineProgressOut(BaseModel):
    raw: int
    processed: int
    skipped: int
    total: int


@router.get("/articles/stats", response_model=ArticleStatsOut)
def article_collection_stats(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    active = db.query(func.count(Article.id)).filter(Article.archived_at.is_(None)).scalar() or 0
    archived = (
        db.query(func.count(Article.id)).filter(Article.archived_at.isnot(None)).scalar() or 0
    )
    return ArticleStatsOut(active=int(active), archived=int(archived))


@router.get("/articles/pipeline-progress", response_model=PipelineProgressOut)
def article_pipeline_progress(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Lightweight counts by article status for the live progress ticker."""
    rows = db.query(Article.status, func.count(Article.id)).group_by(Article.status).all()
    counts = {str(status.value): cnt for status, cnt in rows}
    raw = counts.get("raw", 0)
    processed = counts.get("processed", 0)
    skipped = counts.get("skipped", 0)
    total = raw + processed + skipped + counts.get("published", 0)
    return PipelineProgressOut(raw=raw, processed=processed, skipped=skipped, total=total)


@router.get("/articles", response_model=list[ArticleListItem])
def list_articles(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
    article_status: str | None = Query(default=None, alias="status"),
    archive: str = Query(
        default="active",
        description="active = non-archived only; archived = archived only; all = both",
    ),
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Return articles ordered by published_at descending. Optional status filter (comma-separated)."""
    q = db.query(Article).options(joinedload(Article.source), joinedload(Article.topic))
    if article_status:
        statuses = [s.strip() for s in article_status.split(",") if s.strip()]
        if statuses:
            q = q.filter(Article.status.in_(statuses))
    if archive == "active":
        q = q.filter(Article.archived_at.is_(None))
    elif archive == "archived":
        q = q.filter(Article.archived_at.isnot(None))
    elif archive != "all":
        raise HTTPException(status_code=400, detail="archive must be active, archived, or all")
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
            archived_at=a.archived_at,
        )
        for a in rows
    ]


# ---------------------------------------------------------------------------
# Pipeline / site settings (DB overrides on top of .env)
# ---------------------------------------------------------------------------


class PipelineSettingsUpdate(BaseModel):
    trend_window_days: int | None = Field(default=None, ge=1, le=120)
    trend_prior_window_days: int | None = Field(default=None, ge=1, le=120)
    article_retention_days: int | None = Field(default=None, ge=1, le=3650)
    article_archive_enabled: bool | None = None
    newsletter_article_lookback_days: int | None = Field(default=None, ge=1, le=365)
    newsletter_send_hour_utc: int | None = Field(default=None, ge=0, le=23)
    newsletter_send_minute_utc: int | None = Field(default=None, ge=0, le=59)
    newsletter_enabled: bool | None = None


@router.get("/settings")
def get_pipeline_settings(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
) -> dict[str, Any]:
    merged = merge_pipeline_settings(db)
    return merged_settings_public_dict(merged)


@router.put("/settings")
def put_pipeline_settings(
    payload: PipelineSettingsUpdate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
) -> dict[str, Any]:
    from ..scheduler import schedule_newsletter_job

    data = payload.model_dump(exclude_unset=True)
    if data:
        upsert_site_config(db, data)
        schedule_newsletter_job()
    merged = merge_pipeline_settings(db)
    return merged_settings_public_dict(merged)


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
    newsletter_briefing: dict[str, str] | None = None
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
    # Newest linked article: prefers RSS publication time, else ingest time (non-archived only).
    latest_article_at: datetime | None = None

    model_config = {"from_attributes": True}


class TopicDetail(TopicOut):
    articles: list[ArticleOut]


class TopicPositioningInsight(BaseModel):
    topic_id: int
    name: str
    domain: str
    urgency_score: float
    article_count: int
    articles_primary_window: int = Field(
        description="Article count in primary window (coverage time; see pipeline settings)",
    )
    articles_prior_window: int = Field(description="Article count in prior comparison window")
    primary_window_days: int
    prior_window_days: int
    trend: str = Field(description="up | down | flat")
    label: str
    note: str
    ai_enriched: bool


class HotTopicBrief(BaseModel):
    id: int
    name: str
    domain: str
    subdomain: str = ""
    urgency_score: float


class HotArticleBrief(BaseModel):
    id: int
    title: str
    url: str
    published_at: datetime | None
    ingested_at: datetime
    source_name: str | None = None


class HotOfDayOut(BaseModel):
    """Hot topic = max article count in primary window among on-radar topics; hot article = latest ingest in-window."""

    trend_window_days: int
    hot_topic: HotTopicBrief | None
    articles_in_window: int
    hot_article: HotArticleBrief | None


class TopicUpdate(BaseModel):
    summary: str | None = None
    newsletter_briefing: dict[str, str] | None = None
    urgency_score: float | None = None
    adoption_state: AdoptionState | None = None
    industry_positions: dict | None = None
    persona_by_role: dict[str, str] | None = None
    subdomain: str | None = None


@router.get("/topics", response_model=list[TopicOut])
def list_topics(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
    topic_status: TopicStatus | None = Query(default=None, alias="status"),
    is_published: bool | None = Query(default=None),
    radar_pipeline: bool = Query(
        default=False,
        description="If true, return watched + selected topics (radar pipeline). Ignores single status filter.",
    ),
):
    from sqlalchemy.orm import aliased

    from ..services.signal_service import compute_topic_velocity_metrics

    q = db.query(Topic)
    if radar_pipeline:
        q = q.filter(Topic.status.in_([TopicStatus.watched, TopicStatus.selected]))
    elif topic_status is not None:
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
    signal_rows = db.query(SigAlias).join(latest_sq, SigAlias.id == latest_sq.c.max_id).all()
    sig_map: dict[int, SignalRecommendation] = {s.topic_id: s for s in signal_rows}

    latest_article_rows = (
        db.query(
            Article.topic_id,
            func.max(func.coalesce(Article.published_at, Article.ingested_at)).label(
                "latest_article_at"
            ),
        )
        .filter(Article.topic_id.in_(topic_ids))
        .filter(Article.archived_at.is_(None))
        .group_by(Article.topic_id)
        .all()
    )
    latest_article_map: dict[int, datetime] = {
        row.topic_id: row.latest_article_at for row in latest_article_rows
    }

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
                newsletter_briefing=t.newsletter_briefing,
                urgency_score=t.urgency_score,
                status=t.status.value,
                adoption_state=t.adoption_state.value
                if hasattr(t.adoption_state, "value")
                else str(t.adoption_state),
                industry_positions=t.industry_positions,
                persona_by_role=t.persona_by_role,
                article_count=t.article_count,
                is_published=t.is_published,
                velocity_score=vel,
                acceleration_score=accel,
                signal_rationale=sig.rationale if sig else None,
                signal_suggested_action=sig.suggested_action if sig else None,
                signal_id=sig.id if sig else None,
                latest_article_at=latest_article_map.get(t.id),
            )
        )
    return result


@router.get("/topics/positioning-insights", response_model=list[TopicPositioningInsight])
def topic_positioning_insights(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Article velocity (primary vs prior window, coverage time) plus optional Haiku synthesis."""
    from ..services.trend_service import build_positioning_insights

    return build_positioning_insights(db, status=TopicStatus.selected)


@router.get("/trending/hot-of-day", response_model=HotOfDayOut)
def trending_hot_of_day(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """On-radar topic with the most articles in the primary trend window + latest ingested article in that window."""
    from ..services.trend_service import build_hot_of_day

    return build_hot_of_day(db)


@router.get("/topics/{topic_id}", response_model=TopicDetail)
def get_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    if payload.summary is not None:
        topic.summary = payload.summary
    if payload.newsletter_briefing is not None:
        topic.newsletter_briefing = payload.newsletter_briefing
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
    _: AdminUser = Depends(require_admin),
):
    """Ask Claude to suggest per-industry impact, risk, adoption state, and rationales."""
    try:
        result = suggest_industry_positions(topic_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.post("/topics/{topic_id}/ensure-industry-grid")
def ensure_industry_grid(
    topic_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """
    Add any missing Analysis / radar columns for this topic (same 20 industries as the grid).
    Use after promoting a topic that only had partial industry JSON, or to repair legacy rows.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    updated = ensure_topic_industry_grid_complete(topic_id, db)
    db.refresh(topic)
    n = len(topic.industry_positions) if isinstance(topic.industry_positions, dict) else 0
    return {"updated": updated, "industry_columns": n}


@router.post("/topics/{topic_id}/suggest-persona-by-role")
def suggest_persona_by_role(
    topic_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Ask Claude to synthesize topic-level persona lines per Role (Analysis Persona tab)."""
    try:
        return suggest_topic_persona_by_role(topic_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class BulkSubdomainBody(BaseModel):
    topic_ids: list[int]


@router.post("/topics/{topic_id}/suggest-subdomain")
def suggest_subdomain(
    topic_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """AI label for subdomain theme — groups trends as domain × subdomain × topic name."""
    try:
        subdomain = suggest_subdomain_for_topic(topic_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("suggest_subdomain failed for topic %s", topic_id)
        raise HTTPException(status_code=502, detail="AI subdomain suggestion failed") from exc
    return {"id": topic_id, "subdomain": subdomain}


@router.post("/topics/bulk-suggest-subdomains")
def bulk_suggest_subdomains(
    payload: BulkSubdomainBody,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Run subdomain labelling for many topics (sequential; max 50 ids per request)."""
    ids = payload.topic_ids[:50]
    updated: list[dict[str, int | str]] = []
    errors: list[dict[str, int | str]] = []
    for tid in ids:
        try:
            sub = suggest_subdomain_for_topic(tid, db)
            updated.append({"id": tid, "subdomain": sub})
        except Exception as exc:
            logger.warning("bulk suggest_subdomain failed for topic %s: %s", tid, exc)
            errors.append({"id": tid, "detail": str(exc)})
    return {"updated": updated, "errors": errors}


@router.post("/topics/{topic_id}/trend-analysis")
def run_topic_trend_analysis(
    topic_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
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
        raise HTTPException(
            status_code=400, detail="Trend analysis is not available for this topic status"
        )

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
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    try:
        ensure_topic_industry_grid_complete(topic_id, db)
    except Exception:
        logger.exception("ensure_topic_industry_grid_complete failed after select_topic")
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/deselect", response_model=TopicOut)
def deselect_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
        try:
            ensure_topic_industry_grid_complete(topic_id, db)
        except Exception:
            logger.exception("ensure_topic_industry_grid_complete failed after approve_topic")
        db.refresh(topic)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

    return topic


@router.post("/topics/{topic_id}/publish", response_model=TopicOut)
def publish_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
):
    from ..services.ai_service import generate_topic_summary  # avoid circular at module level

    topic = db.query(Topic).options(joinedload(Topic.articles)).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    articles = topic.articles
    generate_topic_summary(topic, list(articles), db)
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
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
):
    signal = db.query(SignalRecommendation).filter(SignalRecommendation.id == signal_id).first()
    if signal is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    signal.status = "rejected"
    db.commit()
    return {"status": "rejected"}


# ---------------------------------------------------------------------------
# Prompt proposals (optimizer)
# ---------------------------------------------------------------------------


def _next_prompt_version_after_approval(base_version: str) -> str:
    """Bump minor segment (e.g. 1.0.0 → 1.1.0); handles ``fallback`` and simple semver."""
    s = (base_version or "").strip()
    if s == "fallback":
        return "1.1.0"
    parts = s.split(".")
    if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
        return f"{int(parts[0])}.{int(parts[1]) + 1}.0"
    if len(parts) >= 1 and parts[0].isdigit():
        return f"{int(parts[0])}.1.0"
    return "1.1.0"


class PromptProposalOut(BaseModel):
    id: int
    agent_name: str
    base_version: str
    proposed_system_prompt: str
    rationale: str
    test_improvement_score: float | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PromptTemplateOut(BaseModel):
    id: int
    agent_name: str
    version: str
    is_active: bool
    created_at: datetime
    system_prompt: str

    model_config = {"from_attributes": True}


@router.get("/prompt-proposals", response_model=list[PromptProposalOut])
def list_prompt_proposals(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
    status: str = Query(
        default="pending",
        description="Filter: pending | approved | rejected | all",
    ),
):
    q = db.query(PromptProposal).order_by(PromptProposal.created_at.desc())
    s = (status or "pending").strip().lower()
    if s != "all":
        q = q.filter(PromptProposal.status == s)
    return q.all()


@router.post("/prompt-proposals/{proposal_id}/approve")
def approve_prompt_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    proposal = db.query(PromptProposal).filter(PromptProposal.id == proposal_id).first()
    if proposal is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Proposal is not pending (status={proposal.status!r})",
        )

    agent_name = proposal.agent_name
    db.query(PromptTemplate).filter(PromptTemplate.agent_name == agent_name).update(
        {PromptTemplate.is_active: False},
        synchronize_session=False,
    )
    new_version = _next_prompt_version_after_approval(proposal.base_version)
    db.add(
        PromptTemplate(
            agent_name=agent_name,
            version=new_version,
            system_prompt=proposal.proposed_system_prompt,
            is_active=True,
        )
    )
    proposal.status = "approved"
    db.commit()
    clear_prompt_template_cache()
    return {
        "message": f"Prompt {new_version} is now active for {agent_name}.",
        "new_version": new_version,
    }


@router.post("/prompt-proposals/{proposal_id}/reject")
def reject_prompt_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    proposal = db.query(PromptProposal).filter(PromptProposal.id == proposal_id).first()
    if proposal is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Proposal is not pending (status={proposal.status!r})",
        )
    proposal.status = "rejected"
    db.commit()
    return {"message": "Proposal rejected."}


@router.get("/prompt-templates", response_model=list[PromptTemplateOut])
def list_prompt_templates(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
    agent: str = Query(default="all", description='Agent name or "all"'),
):
    q = db.query(PromptTemplate).order_by(PromptTemplate.created_at.desc())
    a = (agent or "all").strip().lower()
    if a != "all":
        q = q.filter(PromptTemplate.agent_name == agent)
    return q.all()


# ---------------------------------------------------------------------------
# AI agent runs (telemetry)
# ---------------------------------------------------------------------------


def _agent_run_status(ar: AgentRun) -> str:
    if ar.fallback_used:
        return "fallback"
    if ar.is_success:
        return "success"
    return "failed"


def _apply_agent_run_status_filter(q, status: str | None):
    if not status or status == "all":
        return q
    s = status.lower()
    if s == "success":
        return q.filter(AgentRun.is_success.is_(True), AgentRun.fallback_used.is_(False))
    if s == "fallback":
        return q.filter(AgentRun.fallback_used.is_(True))
    if s == "failed":
        return q.filter(AgentRun.is_success.is_(False), AgentRun.fallback_used.is_(False))
    return q


class AgentRunSummaryOut(BaseModel):
    total_runs: int
    success_rate: float
    avg_latency_ms: float | None
    total_tokens: int


@router.get("/agent-runs/summary", response_model=AgentRunSummaryOut)
def agent_runs_summary(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    cutoff = datetime.now(UTC) - timedelta(hours=24)
    base = db.query(AgentRun).filter(AgentRun.created_at >= cutoff)
    total_runs = base.count()
    success_n = (
        db.query(AgentRun)
        .filter(
            AgentRun.created_at >= cutoff,
            AgentRun.is_success.is_(True),
            AgentRun.fallback_used.is_(False),
        )
        .count()
    )
    success_rate = (100.0 * success_n / total_runs) if total_runs else 0.0
    avg_lat = db.query(func.avg(AgentRun.latency_ms)).filter(AgentRun.created_at >= cutoff).scalar()
    total_tokens_row = (
        db.query(func.coalesce(func.sum(AgentRun.tokens), 0))
        .filter(AgentRun.created_at >= cutoff)
        .scalar()
    )
    total_tokens = int(total_tokens_row or 0)
    return AgentRunSummaryOut(
        total_runs=total_runs,
        success_rate=round(success_rate, 2),
        avg_latency_ms=float(avg_lat) if avg_lat is not None else None,
        total_tokens=total_tokens,
    )


class AgentRunByAgentRow(BaseModel):
    agent_name: str
    total_runs: int
    success_rate: float
    fallback_count: int
    avg_latency_ms: float | None
    avg_tokens: float | None


@router.get("/agent-runs/by-agent", response_model=list[AgentRunByAgentRow])
def agent_runs_by_agent(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
    days: int = Query(default=7, ge=1, le=90),
):
    cutoff = datetime.now(UTC) - timedelta(days=days)
    success_sum = func.sum(
        case(
            (and_(AgentRun.is_success.is_(True), AgentRun.fallback_used.is_(False)), 1),
            else_=0,
        )
    ).label("success_n")
    fb_sum = func.sum(case((AgentRun.fallback_used.is_(True), 1), else_=0)).label("fb_n")

    rows = (
        db.query(
            AgentRun.agent_name,
            func.count(AgentRun.id).label("total"),
            success_sum,
            fb_sum,
            func.avg(AgentRun.latency_ms).label("avg_lat"),
            func.avg(AgentRun.tokens).label("avg_tok"),
        )
        .filter(AgentRun.created_at >= cutoff)
        .group_by(AgentRun.agent_name)
        .order_by(func.count(AgentRun.id).desc())
        .all()
    )
    out: list[AgentRunByAgentRow] = []
    for name, total, sn, fn, avg_lat, avg_tok in rows:
        total = int(total or 0)
        sn_i = int(sn or 0)
        fn_i = int(fn or 0)
        sr = (100.0 * sn_i / total) if total else 0.0
        out.append(
            AgentRunByAgentRow(
                agent_name=name,
                total_runs=total,
                success_rate=round(sr, 2),
                fallback_count=fn_i,
                avg_latency_ms=float(avg_lat) if avg_lat is not None else None,
                avg_tokens=float(avg_tok) if avg_tok is not None else None,
            )
        )
    return out


class AgentRunListItemOut(BaseModel):
    id: int
    agent_name: str
    created_at: datetime
    article_id: int | None
    article_title: str | None
    status: str
    latency_ms: int | None
    tokens: int | None
    model: str | None

    model_config = {"from_attributes": True}


class AgentRunListResponse(BaseModel):
    items: list[AgentRunListItemOut]
    total: int
    limit: int
    offset: int


def _agent_runs_filtered_query(
    db: Session,
    agent: str | None,
    status: str | None,
):
    q = db.query(AgentRun, Article.title).outerjoin(Article, AgentRun.article_id == Article.id)
    if agent:
        q = q.filter(AgentRun.agent_name == agent)
    q = _apply_agent_run_status_filter(q, status)
    return q


@router.get("/agent-runs", response_model=AgentRunListResponse)
def list_agent_runs(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
    agent: str | None = Query(default=None, description="Filter by agent_name"),
    status: str | None = Query(
        default=None,
        description="success | fallback | failed | all",
    ),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    total = _agent_runs_filtered_query(db, agent, status).count()
    page_rows = (
        _agent_runs_filtered_query(db, agent, status)
        .order_by(AgentRun.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items: list[AgentRunListItemOut] = []
    for ar, title in page_rows:
        items.append(
            AgentRunListItemOut(
                id=ar.id,
                agent_name=ar.agent_name,
                created_at=ar.created_at,
                article_id=ar.article_id,
                article_title=title,
                status=_agent_run_status(ar),
                latency_ms=ar.latency_ms,
                tokens=ar.tokens,
                model=ar.model,
            )
        )
    return AgentRunListResponse(items=items, total=total, limit=limit, offset=offset)


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
    _: AdminUser = Depends(require_admin),
):
    return db.query(Source).order_by(Source.name).all()


@router.post("/sources", response_model=SourceOut, status_code=201)
def create_source(
    payload: SourceCreate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    industries: list[str] | None = None
    domains: list[str] | None = None
    role_ids: list[int] | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriberCreate(BaseModel):
    """Same fields as public subscribe, plus optional is_active — for manual admin setup."""

    email: str
    first_name: str
    last_name: str
    industries: list[str] | None = None
    domains: list[str] | None = None
    role_ids: list[int] | None = None
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _SUBSCRIBER_EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v


@router.post("/subscribers", response_model=SubscriberOut, status_code=201)
def create_subscriber(
    payload: SubscriberCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Create a subscriber manually (same data model as the public subscribe form)."""
    if db.query(Subscriber).filter(Subscriber.email == payload.email).first():
        raise HTTPException(
            status_code=409,
            detail="A subscriber with this email already exists",
        )
    inds, rids = validate_industries_and_role_ids(db, payload.industries, payload.role_ids)

    subscriber = Subscriber(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        industries=inds,
        domains=payload.domains,
        role_ids=rids,
        is_active=payload.is_active,
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(sync_subscriber_to_hubspot, subscriber)
    return subscriber


@router.get("/subscribers", response_model=list[SubscriberOut])
def list_subscribers(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    return db.query(Subscriber).order_by(Subscriber.created_at.desc()).all()


@router.put("/subscribers/{subscriber_id}", response_model=SubscriberOut)
def replace_subscriber(
    subscriber_id: int,
    payload: SubscriberCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Replace subscriber fields (same payload as create). Syncs to HubSpot after save."""
    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    other = (
        db.query(Subscriber)
        .filter(Subscriber.email == payload.email, Subscriber.id != subscriber_id)
        .first()
    )
    if other:
        raise HTTPException(
            status_code=409,
            detail="Another subscriber already uses this email",
        )
    inds, rids = validate_industries_and_role_ids(db, payload.industries, payload.role_ids)

    subscriber.email = payload.email
    subscriber.first_name = payload.first_name
    subscriber.last_name = payload.last_name
    subscriber.industries = inds
    subscriber.domains = payload.domains
    subscriber.role_ids = rids
    subscriber.is_active = payload.is_active
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(sync_subscriber_to_hubspot, subscriber)
    return subscriber


@router.delete("/subscribers/{subscriber_id}", status_code=204)
def delete_subscriber(
    subscriber_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    db.delete(subscriber)
    db.commit()
    return None


class SubscriberRoleUpdate(BaseModel):
    role_ids: list[int] | None = None


@router.put("/subscribers/{subscriber_id}/role", response_model=SubscriberOut)
def update_subscriber_role(
    subscriber_id: int,
    payload: SubscriberRoleUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    _, rids = validate_industries_and_role_ids(db, None, payload.role_ids)
    subscriber.role_ids = rids
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
    _: AdminUser = Depends(require_admin),
):
    return db.query(Role).order_by(Role.name).all()


@router.post("/roles", response_model=RoleOut, status_code=201)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    _: AdminUser = Depends(require_admin),
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
    image_url: str | None = None
    tags: list[str] = []
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentItemCreate(BaseModel):
    title: str
    url: str
    type: str
    summary: str | None = None
    image_url: str | None = None
    tags: list[str] = []


class ContentItemUpdate(BaseModel):
    title: str | None = None
    url: str | None = None
    type: str | None = None
    summary: str | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    is_active: bool | None = None


@router.get("/content", response_model=list[ContentItemOut])
def list_content(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    return db.query(ContentItem).order_by(ContentItem.created_at.desc()).all()


@router.post("/content", response_model=ContentItemOut, status_code=201)
def create_content(
    payload: ContentItemCreate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    if payload.type not in CONTENT_TYPES:
        raise HTTPException(status_code=422, detail=f"type must be one of {sorted(CONTENT_TYPES)}")
    item = ContentItem(
        title=payload.title,
        url=payload.url,
        type=payload.type,
        summary=payload.summary,
        image_url=payload.image_url,
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
    _: AdminUser = Depends(require_admin),
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
    if payload.image_url is not None:
        item.image_url = payload.image_url
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
    _: AdminUser = Depends(require_admin),
):
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Content item not found")
    db.delete(item)
    db.commit()


# ---------------------------------------------------------------------------
# Newsletter preview
# ---------------------------------------------------------------------------


@router.get("/newsletter/preview-filters")
def newsletter_preview_filters(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """
    Canonical industry grid (same as Analysis / AI) plus distinct topic.domain values.

    Domains are limited to **selected** topics — the same population as the Radar Publishing
    table (`GET /topics?status=selected`), so chip labels match the DOMAIN column. (Daily sends
    can still include watched or published topics; those domains are omitted here on purpose.)
    """
    domain_rows = (
        db.query(Topic.domain)
        .filter(Topic.status == TopicStatus.selected)
        .distinct()
        .order_by(Topic.domain.asc())
        .all()
    )
    domains = [row[0] for row in domain_rows if row[0]]
    return {"industries": list(INDUSTRY_GRID_LABELS), "domains": domains}


@router.get("/newsletter/preview", response_class=HTMLResponse)
def newsletter_preview(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
    industries: list[str] = Query(default=[]),
    domains: list[str] = Query(default=[]),
    role_ids: list[int] = Query(default=[]),
):
    """Return a fully rendered HTML newsletter for a simulated subscriber profile."""
    return HTMLResponse(
        content=generate_newsletter_preview(
            db,
            industries=industries or None,
            domains=domains or None,
            role_ids=role_ids or None,
        )
    )


@router.get("/newsletter/survey-stats")
def get_survey_stats(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Counts newsletter feedback responses in the last 7 days."""
    cutoff = datetime.now(UTC) - timedelta(days=7)
    rows = (
        db.query(SurveyResponse.score, func.count())
        .filter(SurveyResponse.created_at >= cutoff)
        .group_by(SurveyResponse.score)
        .all()
    )
    total = sum(r[1] for r in rows)
    breakdown = {r[0]: r[1] for r in rows}
    return {
        "total": total,
        "highly_relevant": breakdown.get(3, 0),
        "somewhat_relevant": breakdown.get(2, 0),
        "not_relevant": breakdown.get(1, 0),
    }


@router.get("/newsletter/feedback")
def get_newsletter_feedback(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    _: AdminUser = Depends(require_admin),
):
    """Rating System / Feedback campaign view for Pulse of Technology Daily."""
    rows = db.query(SurveyResponse).order_by(SurveyResponse.created_at.desc()).limit(limit).all()
    counts = db.query(SurveyResponse.score, func.count()).group_by(SurveyResponse.score).all()
    total = sum(r[1] for r in counts)
    score_sum = sum(int(score) * int(count) for score, count in counts)
    breakdown = {r[0]: r[1] for r in counts}
    return {
        "campaign": "Pulse of Technology Daily",
        "total": total,
        "average_score": round(score_sum / total, 2) if total else None,
        "highly_relevant": breakdown.get(3, 0),
        "somewhat_relevant": breakdown.get(2, 0),
        "not_relevant": breakdown.get(1, 0),
        "responses": [
            {
                "id": str(row.id),
                "subscriber_email": row.subscriber_email,
                "score": row.score,
                "newsletter_date": row.newsletter_date,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
    }


class NewsletterTestSendRequest(BaseModel):
    """Avoid pydantic EmailStr — it requires optional `email-validator` not in the API image."""

    to_email: str = Field(..., min_length=3, max_length=320)

    @field_validator("to_email")
    @classmethod
    def email_format(cls, v: str) -> str:
        s = v.strip().lower()
        if not _SUBSCRIBER_EMAIL_RE.match(s):
            raise ValueError("Invalid email address")
        return s


@router.post("/newsletter/test-send")
def newsletter_test_send(
    body: NewsletterTestSendRequest,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    """Send one newsletter to the given address using current watched/selected topics (admin QA)."""
    ok, msg = send_test_newsletter(db, body.to_email)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}


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
    from ..services.signal_service import (
        backfill_missing_trend_suggestions,
        cleanup_empty_topics,
        refresh_all_signals,
        run_signal_scorer,
    )

    db = SessionLocal()
    try:
        processed = run_article_processing_pipeline(db)
        if processed:
            logger.info(
                "Process-raw: %d articles done — running signal scorer for fresh velocity/acceleration",
                processed,
            )
            try:
                cleanup_empty_topics(db)
                run_signal_scorer(db)
            except Exception:
                logger.exception("Signal scorer after process-raw failed")
        try:
            refresh_all_signals(db)
        except Exception:
            logger.exception("refresh_all_signals after process-raw failed")
        try:
            n = backfill_missing_trend_suggestions(db, limit=50)
            if n:
                logger.info("After process-raw job: trend suggestion backfill for %d topic(s)", n)
        except Exception:
            logger.exception("Trend suggestion backfill after process-raw failed")
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
    _: AdminUser = Depends(require_admin),
):
    background_tasks.add_task(_run_ingest)
    return {"message": "RSS ingestion started in the background."}


@router.post("/jobs/process")
def trigger_process_raw(
    background_tasks: BackgroundTasks,
    _: AdminUser = Depends(require_admin),
):
    """Run AI classification + embeddings on existing raw articles (no RSS fetch)."""
    background_tasks.add_task(_run_process_raw)
    return {"message": "Raw article processing started in the background."}


@router.post("/jobs/newsletter")
def trigger_newsletter(
    background_tasks: BackgroundTasks,
    _: AdminUser = Depends(require_admin),
):
    background_tasks.add_task(_run_newsletter)
    return {"message": "Newsletter dispatch started in the background."}


def _run_signals() -> None:
    from ..services.signal_service import execute_full_signal_flow

    db = SessionLocal()
    try:
        execute_full_signal_flow(db)
    except Exception:
        logger.exception("Unhandled error in admin-triggered signal flow")
    finally:
        db.close()


@router.post("/jobs/signals")
def trigger_signals(
    background_tasks: BackgroundTasks,
    _: AdminUser = Depends(require_admin),
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
            .filter(
                Topic.status.in_([TopicStatus.pending, TopicStatus.watched, TopicStatus.selected])
            )
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
    _: AdminUser = Depends(require_admin),
):
    """Run the AI trend-pick agent for every pending, watched, and selected topic (background)."""
    background_tasks.add_task(_run_trend_analysis_all)
    return {"message": "AI trend analysis started for all pipeline topics."}
