"""
Signal Intelligence service.

Calculates article velocity/acceleration per topic and uses Claude to generate
watch | radar | remove recommendations when thresholds are met.

Velocity/acceleration use a **coverage timestamp** per article:
``GREATEST(ingested_at, published_at)`` for window membership (see ``_article_coverage_time``).

Velocity windows use SQL counts only until production embeddings exist (Pinecone path disabled).

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


def _article_coverage_time():
    """
    Effective time for trend windows: max(ingested_at, published_at).

    RSS sets ingested_at when the row is created; published_at is the story date. Using only
    ingested_at made velocity 0 for backlog processing and misaligned the table with
    “latest article” dates users see in Collection.
    """
    return func.greatest(
        Article.ingested_at,
        func.coalesce(Article.published_at, Article.ingested_at),
    )


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

    Counts articles whose **coverage time** falls in each window: ``GREATEST(ingested_at,
    published_at)`` so backlog processing and same-day publishes align with “latest article” in
    the admin table. Windows come from ``MergedPipelineSettings.trend_window_days`` /
    ``trend_prior_window_days`` (Admin → Settings or env defaults).

    Intentionally does **not** use the Pinecone path for these headline numbers: semantic matches
    can diverge from timestamps and confused the admin table vs SQL counts.
    """
    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    pw = merged.trend_prior_window_days
    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    prior_start = now - timedelta(days=tw + pw)
    velocity = float(_sql_count(topic_id, recent_start, now, db))
    prev_count = _sql_count(topic_id, prior_start, recent_start, db)
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

    ct = _article_coverage_time()
    recent_articles: list[Article] = (
        db.query(Article)
        .filter(
            Article.topic_id == topic_id,
            ct >= recent_start,
            Article.archived_at.is_(None),
        )
        .all()
    )

    total_linked = (
        db.query(func.count(Article.id))
        .filter(Article.topic_id == topic_id, Article.archived_at.is_(None))
        .scalar()
        or 0
    )

    try:
        result = evaluate_trend_pick(
            topic,
            recent_articles,
            db,
            velocity=float(velocity),
            acceleration=float(acceleration),
            total_linked=int(total_linked),
            window_days=tw,
        )
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
        existing.created_at = datetime.now(UTC)
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


def backfill_missing_trend_suggestions(db: Session, *, limit: int = 25) -> int:
    """
    Ensure pipeline topics have at least one SignalRecommendation so the admin
    "Suggestion" column is populated.

    Unlike run_signal_scorer, this does **not** require velocity ≥ VELOCITY_THRESHOLD
    or acceleration ≥ ACCELERATION_THRESHOLD — those gates only apply to the
    high-velocity scorer. Here we only target topics that have **no** signal row yet.

    Returns the number of topics for which upsert_pending_trend_signal succeeded.
    """
    ids_with_signal = {r[0] for r in db.query(SignalRecommendation.topic_id).distinct().all()}
    q = db.query(Topic).filter(
        Topic.status.in_(
            [TopicStatus.pending, TopicStatus.watched, TopicStatus.selected],
        )
    )
    if ids_with_signal:
        q = q.filter(~Topic.id.in_(ids_with_signal))
    candidates = (
        q.order_by(Topic.urgency_score.desc().nulls_last(), Topic.id.desc()).limit(limit).all()
    )
    ok = 0
    for topic in candidates:
        try:
            row = upsert_pending_trend_signal(topic.id, db)
            if row is not None:
                ok += 1
        except Exception:
            logger.exception("backfill_missing_trend_suggestions failed for topic %d", topic.id)
    if ok:
        logger.info("backfill_missing_trend_suggestions: filled %d topic(s) (limit=%d)", ok, limit)
    return ok


def _sql_count(topic_id: int, start: datetime, end: datetime, db: Session) -> int:
    """SQL fallback: count non-archived articles whose coverage time falls in [start, end)."""
    ct = _article_coverage_time()
    return (
        db.query(func.count(Article.id))
        .filter(
            Article.topic_id == topic_id,
            ct >= start,
            ct < end,
            Article.archived_at.is_(None),
        )
        .scalar()
        or 0
    )


def _article_count_in_window(topic_id: int, start: datetime, end: datetime, db: Session) -> int:
    """
    Return article count for topic within [start, end).

    Uses SQL coverage-time counts only. Pinecone semantic velocity is disabled while
    embeddings are placeholder / not production-ready.
    """
    # TODO: Re-enable when Voyage/OpenAI embeddings ship (query_topic_velocity + article_id metadata)
    return _sql_count(topic_id, start, end, db)


def run_signal_scorer(db: Session) -> int:
    """
    Score velocity/acceleration for every topic (pending, watched, selected)
    and create SignalRecommendation records when thresholds are breached.

    Velocity is measured via SQL article counts in coverage-time windows.

    Returns the number of new recommendations created.
    """
    from ..services.ai_service import evaluate_trend_pick  # avoid circular at import time

    merged = merge_pipeline_settings(db)
    tw = merged.trend_window_days
    pw = merged.trend_prior_window_days
    now = datetime.now(UTC)
    recent_start = now - timedelta(days=tw)
    prior_start = now - timedelta(days=tw + pw)

    all_topics: list[Topic] = (
        db.query(Topic)
        .filter(Topic.status.in_([TopicStatus.pending, TopicStatus.watched, TopicStatus.selected]))
        .all()
    )

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

        ct = _article_coverage_time()
        # Fetch recent articles for the AI context
        recent_articles: list[Article] = (
            db.query(Article)
            .filter(
                Article.topic_id == topic.id,
                ct >= recent_start,
                Article.archived_at.is_(None),
            )
            .all()
        )

        total_linked = (
            db.query(func.count(Article.id))
            .filter(Article.topic_id == topic.id, Article.archived_at.is_(None))
            .scalar()
            or 0
        )

        logger.info(
            "Evaluating signal for topic %r: velocity=%d acceleration=%.2f",
            topic.name,
            velocity,
            acceleration,
        )

        try:
            result = evaluate_trend_pick(
                topic,
                recent_articles,
                db,
                velocity=float(velocity),
                acceleration=float(acceleration),
                total_linked=int(total_linked),
                window_days=tw,
            )
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


def refresh_all_signals(db: Session) -> int:
    """
    Re-evaluate every watched and selected topic regardless of velocity thresholds,
    and refresh any pending topic whose existing signal is older than 24 h.

    This keeps the Suggestion column, velocity, and acceleration up to date on
    the Trend Discovery page so curators can promote/demote topics daily.

    Returns the number of signals created or updated.
    """
    refreshed = 0

    # Always refresh watched + selected (the active radar pipeline)
    radar_topics: list[Topic] = (
        db.query(Topic).filter(Topic.status.in_([TopicStatus.watched, TopicStatus.selected])).all()
    )
    for topic in radar_topics:
        try:
            row = upsert_pending_trend_signal(topic.id, db)
            if row is not None:
                refreshed += 1
        except Exception:
            logger.exception("refresh_all_signals failed for radar topic %d", topic.id)

    # Refresh pending topics that already have a signal older than 24 h
    cutoff = datetime.now(UTC) - timedelta(hours=24)
    stale_signals = (
        db.query(SignalRecommendation)
        .join(Topic, SignalRecommendation.topic_id == Topic.id)
        .filter(
            Topic.status == TopicStatus.pending,
            SignalRecommendation.status == "pending",
            SignalRecommendation.created_at < cutoff,
        )
        .all()
    )
    stale_topic_ids = {s.topic_id for s in stale_signals}
    for tid in stale_topic_ids:
        try:
            row = upsert_pending_trend_signal(tid, db)
            if row is not None:
                refreshed += 1
        except Exception:
            logger.exception("refresh_all_signals failed for pending topic %d", tid)

    if refreshed:
        logger.info("refresh_all_signals: updated %d topic(s)", refreshed)
    return refreshed


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


def execute_full_signal_flow(db: Session, *, backfill_limit: int = 50) -> None:
    """
    Run the full signal pipeline in a fixed order:

    1. ``cleanup_empty_topics`` — remove orphaned pending topics with no articles
    2. ``run_signal_scorer`` — create recommendations for high-velocity topics
    3. ``refresh_all_signals`` — refresh watched/selected and stale pending signals
    4. ``backfill_missing_trend_suggestions`` — fill trend suggestions for topics still missing them

    Used by the scheduled signal job and the admin ``/jobs/signals`` trigger.
    Steps 3–4 log and continue on failure so a single bad topic does not abort the run.
    """
    cleanup_empty_topics(db)
    run_signal_scorer(db)
    try:
        refresh_all_signals(db)
    except Exception:
        logger.exception("refresh_all_signals failed in execute_full_signal_flow")
    try:
        n = backfill_missing_trend_suggestions(db, limit=backfill_limit)
        if n:
            logger.info(
                "execute_full_signal_flow: trend suggestion backfill for %d topic(s)",
                n,
            )
    except Exception:
        logger.exception("backfill_missing_trend_suggestions failed in execute_full_signal_flow")
