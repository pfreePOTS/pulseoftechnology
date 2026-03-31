"""
Signal Intelligence service.

Calculates article velocity/acceleration per approved topic and uses Claude
to generate adoption-state upgrade recommendations when thresholds are met.

Velocity/acceleration are measured in two ways (with automatic fallback):
  1. Semantic (Pinecone) — queries the vector index for semantically similar
     articles within each time window, catching cross-topic coverage of the
     same underlying trend.
  2. SQL fallback — plain article count per topic_id when Pinecone is not
     configured or the query fails.

Also provides topic cleanup utilities.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.article import Article
from ..models.signal import SignalRecommendation
from ..models.topic import Topic, TopicStatus

logger = logging.getLogger(__name__)

# Thresholds: fire an AI evaluation when a topic's 7-day article count
# exceeds VELOCITY_THRESHOLD and the ratio vs the prior 7 days exceeds
# ACCELERATION_THRESHOLD.
VELOCITY_THRESHOLD = 3
ACCELERATION_THRESHOLD = 1.5


def _sql_count(topic_id: int, start: datetime, end: datetime, db: Session) -> int:
    """SQL fallback: count articles assigned to topic_id within the window."""
    return (
        db.query(func.count(Article.id))
        .filter(
            Article.topic_id == topic_id,
            Article.ingested_at >= start,
            Article.ingested_at < end,
        )
        .scalar()
        or 0
    )


def _article_count_in_window(topic_id: int, start: datetime, end: datetime, db: Session) -> int:
    """
    Return article count for topic within [start, end).

    Tries Pinecone semantic query first; falls back to SQL.
    """
    from ..services.vector_service import query_topic_velocity  # lazy import

    # Attempt Pinecone semantic velocity
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic:
        since_ts = int(start.timestamp())
        matches = query_topic_velocity(
            topic_id=topic_id,
            domain=topic.domain or "",
            since_ts=since_ts,
        )
        if matches:  # empty list means Pinecone not configured, not "zero articles"
            # Filter to the exact window [start, end)
            end_ts = int(end.timestamp())
            count = sum(1 for m in matches if since_ts <= m.get("published_at", 0) < end_ts)
            logger.debug(
                "Pinecone velocity for topic %d [%s→%s]: %d",
                topic_id,
                start.date(),
                end.date(),
                count,
            )
            return count

    # SQL fallback
    return _sql_count(topic_id, start, end, db)


def run_signal_scorer(db: Session) -> int:
    """
    Score velocity/acceleration for every topic (pending, watched, selected)
    and create SignalRecommendation records when thresholds are breached.

    Velocity is measured via Pinecone semantic query when configured,
    otherwise falls back to SQL article counts.

    Returns the number of new recommendations created.
    """
    from ..services.ai_service import evaluate_signal  # avoid circular at import time

    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)
    prev_start = now - timedelta(days=14)

    all_topics: list[Topic] = db.query(Topic).all()

    created = 0
    for topic in all_topics:
        velocity = _article_count_in_window(topic.id, week_start, now, db)
        prev_count = _article_count_in_window(topic.id, prev_start, week_start, db)

        if velocity < VELOCITY_THRESHOLD:
            continue

        acceleration = velocity / max(prev_count, 1)  # avoid div-by-zero
        if acceleration < ACCELERATION_THRESHOLD:
            continue

        # Check if we already have a pending signal for this topic (avoid duplicates)
        existing = (
            db.query(SignalRecommendation)
            .filter(
                SignalRecommendation.topic_id == topic.id,
                SignalRecommendation.status == "pending",
            )
            .first()
        )
        if existing:
            logger.debug("Skipping topic %d — pending signal already exists", topic.id)
            continue

        # Fetch recent articles for the AI context
        recent_articles: list[Article] = (
            db.query(Article)
            .filter(
                Article.topic_id == topic.id,
                Article.ingested_at >= week_start,
            )
            .all()
        )

        logger.info(
            "Evaluating signal for topic %r: velocity=%d acceleration=%.2f",
            topic.name,
            velocity,
            acceleration,
        )

        try:
            result = evaluate_signal(topic, recent_articles)
        except Exception:
            logger.exception("Error evaluating signal for topic %d", topic.id)
            continue

        if not result.get("recommend_change"):
            logger.debug("Topic %r — AI found no state change warranted", topic.name)
            continue

        signal = SignalRecommendation(
            topic_id=topic.id,
            suggested_state=result["suggested_state"],
            rationale=result["rationale"],
            velocity_score=float(velocity),
            acceleration_score=float(acceleration),
            status="pending",
        )
        db.add(signal)
        db.commit()
        created += 1
        logger.info(
            "Signal created for topic %r → %r (velocity=%d)",
            topic.name,
            result["suggested_state"],
            velocity,
        )

    logger.info("Signal scorer complete: %d new recommendations", created)
    return created


def cleanup_empty_topics(db: Session) -> int:
    """
    Delete pending topics that have no linked articles.
    These are orphaned records left behind after merges or failed ingestion.

    Returns the number of topics deleted.
    """
    from sqlalchemy import func as sa_func

    orphaned: list[Topic] = (
        db.query(Topic)
        .outerjoin(Topic.articles)
        .filter(Topic.status == TopicStatus.pending)
        .group_by(Topic.id)
        .having(sa_func.count(Article.id) == 0)
        .all()
    )

    count = len(orphaned)
    for topic in orphaned:
        db.delete(topic)
    if count:
        db.commit()
        logger.info("Deleted %d empty pending topics", count)
    return count
