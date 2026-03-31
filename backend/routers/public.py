import logging
import re
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models.article import Article
from ..models.role import Role
from ..models.subscriber import Subscriber
from ..models.topic import Topic
from ..rate_limits import limiter
from ..services.hubspot_sync import sync_subscriber_to_hubspot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["public"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


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
    industry: str | None = None
    domains: list[str] | None = None
    role_id: int | None = None

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


class SubscribeResponse(BaseModel):
    id: int
    email: str
    message: str


class ArticleTrackedPublic(BaseModel):
    """Ingested story linked to a live radar topic — same article pool the newsletter uses."""

    id: int
    title: str
    url: str
    published_at: datetime | None
    ingested_at: datetime
    domain: str
    source_name: str | None = None

    model_config = {"from_attributes": True}


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
    rows = (
        db.query(Article)
        .join(Topic, Article.topic_id == Topic.id)
        .filter(Topic.is_published == True)  # noqa: E712
        .options(joinedload(Article.source), joinedload(Article.topic))
        .order_by(Article.ingested_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ArticleTrackedPublic(
            id=a.id,
            title=a.title,
            url=a.url,
            published_at=a.published_at,
            ingested_at=a.ingested_at,
            domain=a.topic.domain if a.topic else "Other",
            source_name=a.source.name if a.source else None,
        )
        for a in rows
    ]


@router.post("/subscribe", response_model=SubscribeResponse, status_code=201)
@limiter.limit("30/minute")
def subscribe(
    request: Request,
    payload: SubscribeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Register a new subscriber with their domain and industry preferences."""
    if payload.role_id is not None:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if role is None:
            raise HTTPException(status_code=422, detail="Invalid role_id")

    existing = db.query(Subscriber).filter(Subscriber.email == payload.email).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=409, detail="This email is already subscribed")
        # Re-activate lapsed subscriber and update their preferences
        existing.is_active = True
        existing.first_name = payload.first_name
        existing.last_name = payload.last_name
        existing.industry = payload.industry
        existing.domains = payload.domains
        existing.role_id = payload.role_id
        db.commit()
        db.refresh(existing)
        background_tasks.add_task(sync_subscriber_to_hubspot, existing)
        return SubscribeResponse(
            id=existing.id, email=existing.email, message="Subscription reactivated"
        )

    subscriber = Subscriber(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        industry=payload.industry,
        domains=payload.domains,
        role_id=payload.role_id,
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(sync_subscriber_to_hubspot, subscriber)
    return SubscribeResponse(
        id=subscriber.id, email=subscriber.email, message="Successfully subscribed"
    )
