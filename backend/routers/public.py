import logging
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.subscriber import Subscriber
from ..models.topic import Topic
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
    summary: str | None
    urgency_score: float
    adoption_state: str
    industry_positions: dict | None = None

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    email: str
    first_name: str
    last_name: str
    industry: str | None = None
    domains: list[str] | None = None

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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/topics/published", response_model=list[TopicPublic])
def get_published_topics(db: Session = Depends(get_db)):
    """Return topics marked as published (live on the public Radar)."""
    return (
        db.query(Topic)
        .filter(Topic.is_published == True)  # noqa: E712
        .order_by(Topic.urgency_score.desc())
        .all()
    )


@router.post("/subscribe", response_model=SubscribeResponse, status_code=201)
def subscribe(
    payload: SubscribeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Register a new subscriber with their domain and industry preferences."""
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
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    background_tasks.add_task(sync_subscriber_to_hubspot, subscriber)
    return SubscribeResponse(
        id=subscriber.id, email=subscriber.email, message="Successfully subscribed"
    )
