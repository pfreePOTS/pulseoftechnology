"""
Signal Intelligence service.

Calculates article velocity/acceleration per topic and uses Claude to generate
watch | radar | remove recommendations when thresholds are met.

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
from .pipeline_settings import merge_pipeline_settings

logger = logging.getLogger(__name__)


def _normalize_trend_action(raw: str | None) -> str:
    if not raw:
        return "watch"
    x = str(raw).strip().lower()
    if x in ("watch", "watching", "hold"):
        return "watch"
    if x in ("radar", "on_radar", "include", "add", "approve", "yes"):
        return "radar"
    if x in ("remove", "drop", "deprioritize", "deprioritise", "no"):
        return "remove"
    return "watch"


# Thresholds: fire an AI evaluation when a topic's 7-day article count
# exceeds VELOCITY_THRESHOLD and the ratio vs the prior 7 days exceeds
# ACCELERATION_THRESHOLD.
VELOCITY_THRESHOLD = 3
ACCELERATION_THRESHOLD = 1.5


def compute_topic_velocity_metrics(topic_id: int, db: Session) -> tuple[float, float]:
    """
    Live article velocity (count in primary window) and acceleration (ratio vs prior window).
    Same windows as run_signal_scorer — used for API responses even when no SignalRecommendation exists.
    """
    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    pw = merged.trend_prior_window_days
    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    prior_start = now - timedelta(days=tw + pw)
    velocity = float(_article_count_in_window(topic_id, recent_start, now, db))
    prev_count = _article_count_in_window(topic_id, prior_start, recent_start, db)
    acceleration = velocity / max(prev_count, 1)
    return velocity, acceleration


def upsert_pending_trend_signal(topic_id: int, db: Session) -> SignalRecommendation | None:
    """
    Run the trend-pick AI agent (evaluate_trend_pick) for this topic and create or update a pending
    SignalRecommendation with computed velocity/acceleration and watch | radar | remove + rationale.

    Unlike run_signal_scorer, this does not require velocity/acceleration thresholds.
    """
    from ..services.ai_service import evaluate_trend_pick  # avoid circular import

    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        return None

    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    velocity, acceleration = compute_topic_velocity_metrics(topic_id, db)

    recent_articles: list[Article] = (
        db.query(Article)
        .filter(
            Article.topic_id == topic_id,
            Article.ingested_at >= recent_start,
            Article.archived_at.is_(None),
        )
        .all()
    )

    try:
        result = evaluate_trend_pick(topic, recent_articles, db)
    except Exception:
        logger.exception("evaluate_trend_pick failed for topic %d", topic_id)
        return None

    action = _normalize_trend_action(result.get("suggested_action"))
    rationale = result.get("rationale") or ""

    existing = (
        db.query(SignalRecommendation)
        .filter(
            SignalRecommendation.topic_id == topic_id,
            SignalRecommendation.status == "pending",
        )
        .first()
    )
    if existing:
        existing.suggested_state = ""
        existing.suggested_action = action
        existing.rationale = rationale
        existing.velocity_score = velocity
        existing.acceleration_score = acceleration
        db.commit()
        db.refresh(existing)
        return existing

    signal = SignalRecommendation(
        topic_id=topic_id,
        suggested_state="",
        suggested_action=action,
        rationale=rationale,
        velocity_score=velocity,
        acceleration_score=acceleration,
        status="pending",
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


def _sql_count(topic_id: int, start: datetime, end: datetime, db: Session) -> int:
    """SQL fallback: count non-archived articles assigned to topic_id within the window."""
    return (
        db.query(func.count(Article.id))
        .filter(
            Article.topic_id == topic_id,
            Article.ingested_at >= start,
            Article.ingested_at < end,
            Article.archived_at.is_(None),
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
            article_ids = [m.get("article_id") for m in matches if m.get("article_id")]
            if article_ids:
                return (
                    db.query(func.count(Article.id))
                    .filter(
                        Article.id.in_(article_ids),
                        Article.topic_id == topic_id,
                        Article.archived_at.is_(None),
                        Article.ingested_at >= start,
                        Article.ingested_at < end,
                    )
                    .scalar()
                    or 0
                )
            # Legacy vectors without article_id in metadata — fall back to SQL counts
            return _sql_count(topic_id, start, end, db)

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
    from ..services.ai_service import evaluate_trend_pick  # avoid circular at import time

    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    pw = merged.trend_prior_window_days
    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    prior_start = now - timedelta(days=tw + pw)

    all_topics: list[Topic] = db.query(Topic).all()

    created = 0
    for topic in all_topics:
        velocity = _article_count_in_window(topic.id, recent_start, now, db)
        prev_count = _article_count_in_window(topic.id, prior_start, recent_start, db)

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
                Article.ingested_at >= recent_start,
                Article.archived_at.is_(None),
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
            result = evaluate_trend_pick(topic, recent_articles, db)
        except Exception:
            logger.exception("Error evaluating trend pick for topic %d", topic.id)
            continue

        action = _normalize_trend_action(result.get("suggested_action"))
        rationale = result.get("rationale") or ""

        signal = SignalRecommendation(
            topic_id=topic.id,
            suggested_state="",
            suggested_action=action,
            rationale=rationale,
            velocity_score=float(velocity),
            acceleration_score=float(acceleration),
            status="pending",
        )
        db.add(signal)
        db.commit()
        created += 1
        logger.info(
            "Signal created for topic %r → %s (velocity=%d)",
            topic.name,
            action,
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
