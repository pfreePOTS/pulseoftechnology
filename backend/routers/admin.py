from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..dependencies import require_admin
from ..models.article import Article
from ..models.source import Source, SourceType
from ..models.subscriber import Subscriber
from ..models.topic import AdoptionState, Topic, TopicStatus
from ..services.email_service import run_daily_newsletter
from ..services.ingestion import run_all_sources

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    """Validate the admin password and return a token (the password itself)."""
    from ..config import settings
    if payload.password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    return LoginResponse(token=payload.password)


# ---------------------------------------------------------------------------
# Topics
# ---------------------------------------------------------------------------

class ArticleOut(BaseModel):
    id: int
    title: str
    url: str
    content: str | None
    status: str

    model_config = {"from_attributes": True}


class TopicOut(BaseModel):
    id: int
    name: str
    domain: str
    summary: str | None
    urgency_score: float
    status: str
    adoption_state: str
    industry_positions: dict | None = None

    model_config = {"from_attributes": True}


class TopicDetail(TopicOut):
    articles: list[ArticleOut]


class TopicUpdate(BaseModel):
    summary: str | None = None
    urgency_score: float | None = None
    adoption_state: AdoptionState | None = None
    industry_positions: dict | None = None


@router.get("/topics", response_model=list[TopicOut])
def list_topics(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    return (
        db.query(Topic)
        .filter(Topic.status == TopicStatus.pending)
        .order_by(Topic.urgency_score.desc())
        .all()
    )


@router.get("/topics/{topic_id}", response_model=TopicDetail)
def get_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
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

    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/approve", response_model=TopicOut)
def approve_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status == TopicStatus.approved:
        raise HTTPException(status_code=409, detail="Topic is already approved")

    topic.status = TopicStatus.approved
    db.query(Article).filter(Article.topic_id == topic_id).update(
        {"status": "published"}, synchronize_session=False
    )
    db.commit()
    db.refresh(topic)
    return topic


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
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/subscribers", response_model=list[SubscriberOut])
def list_subscribers(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    return db.query(Subscriber).order_by(Subscriber.created_at.desc()).all()


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

def _run_ingest() -> None:
    db = SessionLocal()
    try:
        run_all_sources(db)
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


@router.post("/jobs/newsletter")
def trigger_newsletter(
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
):
    background_tasks.add_task(_run_newsletter)
    return {"message": "Newsletter dispatch started in the background."}
