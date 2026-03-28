from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.article import Article
from ..models.topic import Topic, TopicStatus, AdoptionState

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Pydantic schemas
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

    model_config = {"from_attributes": True}


class TopicDetail(TopicOut):
    articles: list[ArticleOut]


class TopicUpdate(BaseModel):
    summary: str | None = None
    urgency_score: float | None = None
    adoption_state: AdoptionState | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/topics", response_model=list[TopicOut])
def list_topics(db: Session = Depends(get_db)):
    """Return all pending topics awaiting curation review."""
    return (
        db.query(Topic)
        .filter(Topic.status == TopicStatus.pending)
        .order_by(Topic.urgency_score.desc())
        .all()
    )


@router.get("/topics/{topic_id}", response_model=TopicDetail)
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    """Return a single topic with its associated articles."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.put("/topics/{topic_id}", response_model=TopicOut)
def update_topic(topic_id: int, payload: TopicUpdate, db: Session = Depends(get_db)):
    """Update a topic's summary or urgency score."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    if payload.summary is not None:
        topic.summary = payload.summary
    if payload.urgency_score is not None:
        topic.urgency_score = payload.urgency_score
    if payload.adoption_state is not None:
        topic.adoption_state = payload.adoption_state

    db.commit()
    db.refresh(topic)
    return topic


@router.post("/topics/{topic_id}/approve", response_model=TopicOut)
def approve_topic(topic_id: int, db: Session = Depends(get_db)):
    """Mark a topic as approved for publishing."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.status == TopicStatus.approved:
        raise HTTPException(status_code=409, detail="Topic is already approved")

    topic.status = TopicStatus.approved

    # Mark all associated articles as published
    db.query(Article).filter(Article.topic_id == topic_id).update(
        {"status": "published"}, synchronize_session=False
    )

    db.commit()
    db.refresh(topic)
    return topic
