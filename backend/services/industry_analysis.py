"""Automatic Industry Positioning runs for on-radar (selected) topics.

Triggered when a topic is selected/approved, by the hourly sweep, and by the Analysis
"AI Suggest (all topics)" button. Progress lives on the topic row, so a restart only
delays work: the next sweep picks up any topic that still has placeholder cells.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from ..models.topic import Topic, TopicStatus
from .ai_service import (
    INDUSTRY_GRID_LABELS,
    fill_missing_industry_grid_rows,
    suggest_industry_positions,
)
from .industry_cells import is_placeholder_cell, merge_ai_industry_rows

logger = logging.getLogger(__name__)

CLAIM_TTL = timedelta(minutes=15)
MAX_ATTEMPTS = 3
SWEEP_LIMIT = 10


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def pending_industry_labels(topic: Topic) -> list[str]:
    """Grid columns that are missing or still placeholder backfill."""
    ip = topic.industry_positions if isinstance(topic.industry_positions, dict) else {}
    return [label for label in INDUSTRY_GRID_LABELS if is_placeholder_cell(ip.get(label))]


def _claim(db: Session, topic_id: int, now: datetime) -> bool:
    res = db.execute(
        update(Topic)
        .where(
            Topic.id == topic_id,
            or_(
                Topic.industry_analysis_started_at.is_(None),
                Topic.industry_analysis_started_at < now - CLAIM_TTL,
            ),
        )
        .values(industry_analysis_started_at=now)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return res.rowcount == 1


def analyze_topic_industries(topic_id: int, db: Session) -> bool:
    """Run Industry Positioning for one topic and merge it into the grid.

    Returns True when every column ends up analyzed. Manual cells are kept.
    """
    now = datetime.now(UTC)
    if not _claim(db, topic_id, now):
        logger.info("[industry_analysis] topic id=%s already being analyzed — skipped", topic_id)
        return False
    try:
        result = suggest_industry_positions(topic_id, db)
        sug = result.get("industry_suggestions")
        if not isinstance(sug, dict):
            raise ValueError("AI response missing industry_suggestions")
        topic = db.get(Topic, topic_id)
        if topic is None:
            return False
        merged = merge_ai_industry_rows(topic.industry_positions, sug)
        topic.industry_positions = fill_missing_industry_grid_rows(topic, merged)
        topic.industry_analyzed_at = datetime.now(UTC)
        topic.industry_analysis_started_at = None
        pending = pending_industry_labels(topic)
        if pending:
            topic.industry_analysis_attempts = (topic.industry_analysis_attempts or 0) + 1
            topic.industry_analysis_error = (
                f"AI did not return {len(pending)} industr{'y' if len(pending) == 1 else 'ies'}: "
                + ", ".join(pending)
            )[:500]
            logger.warning(
                "[industry_analysis] topic id=%s incomplete: %d industries still pending %s",
                topic_id,
                len(pending),
                pending[:8],
            )
        else:
            topic.industry_analysis_attempts = 0
            topic.industry_analysis_error = None
            logger.info("[industry_analysis] topic id=%s analyzed (%r)", topic_id, topic.name)
        db.commit()
        return not pending
    except Exception as exc:
        db.rollback()
        logger.exception("[industry_analysis] topic id=%s failed", topic_id)
        topic = db.get(Topic, topic_id)
        if topic is not None:
            topic.industry_analysis_attempts = (topic.industry_analysis_attempts or 0) + 1
            topic.industry_analysis_error = (str(exc) or type(exc).__name__)[:500]
            topic.industry_analysis_started_at = None
            db.commit()
        return False


def topics_due_for_industry_analysis(
    db: Session, *, limit: int = SWEEP_LIMIT, now: datetime | None = None
) -> list[Topic]:
    """Selected topics with pending cells, under the retry cap and not claimed; oldest first."""
    now = now or datetime.now(UTC)
    rows = (
        db.query(Topic)
        .filter(
            Topic.status == TopicStatus.selected,
            Topic.industry_analysis_attempts < MAX_ATTEMPTS,
        )
        .all()
    )
    due = []
    for t in rows:
        started = _as_utc(t.industry_analysis_started_at)
        if started is not None and started >= now - CLAIM_TTL:
            continue
        if pending_industry_labels(t):
            due.append(t)
    oldest = datetime.min.replace(tzinfo=UTC)
    due.sort(key=lambda t: (_as_utc(t.selected_at) or oldest, t.id))
    return due[:limit]


def run_industry_analysis_sweep(db: Session, *, limit: int = SWEEP_LIMIT) -> int:
    """Analyze up to ``limit`` due topics. Returns how many finished fully analyzed."""
    topic_ids = [t.id for t in topics_due_for_industry_analysis(db, limit=limit)]
    if not topic_ids:
        return 0
    logger.info("[industry_analysis] sweep started: %d topic(s) due", len(topic_ids))
    done = sum(1 for tid in topic_ids if analyze_topic_industries(tid, db))
    logger.info("[industry_analysis] sweep finished: %d/%d analyzed", done, len(topic_ids))
    return done
