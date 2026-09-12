"""Archive articles past retention — soft-archive via ``archived_at``."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_ as db_and
from sqlalchemy import or_ as db_or
from sqlalchemy.orm import Session

from ..models.article import Article, ArticleStatus
from .pipeline_settings import merge_pipeline_settings

logger = logging.getLogger(__name__)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def article_coverage_datetime(article: Article) -> datetime:
    """Return the coverage timestamp used for trend evidence windows."""
    ingested = _as_utc(article.ingested_at) or datetime.now(UTC)
    published = _as_utc(article.published_at)
    if published is None:
        return ingested
    return published


def active_evidence_window_days(db: Session) -> int:
    """Trend Discovery active evidence = primary window + prior comparison window."""
    merged = merge_pipeline_settings(db)
    return merged.trend_window_days + merged.trend_prior_window_days


def archive_outside_active_evidence_window(db: Session) -> int:
    """
    Soft-archive linked topic articles outside the active evidence window.

    This keeps old rows for audit/deduplication while preventing historical articles from
    driving Trend Discovery counts or cluttering supporting evidence lists.
    """
    merged = merge_pipeline_settings(db)
    if not merged.article_archive_enabled:
        return 0

    evidence_days = merged.trend_window_days + merged.trend_prior_window_days
    cutoff = datetime.now(UTC) - timedelta(days=evidence_days)
    candidates = (
        db.query(Article)
        .filter(
            Article.archived_at.is_(None),
            Article.topic_id.isnot(None),
        )
        .all()
    )
    now = datetime.now(UTC)
    stale = [article for article in candidates if article_coverage_datetime(article) < cutoff]
    for article in stale:
        article.archived_at = now
    if stale:
        db.commit()
        logger.info(
            "Archived %d topic article(s) outside %d-day active evidence window",
            len(stale),
            evidence_days,
        )
    return len(stale)


def archive_old_articles(db: Session) -> int:
    """
    Set archived_at on articles older than the configured retention period.

    An article is stale when **either** its ingested_at or its published_at
    (if present) is older than the cutoff.  An article published in 2015
    but ingested today is not trending news.
    """
    merged = merge_pipeline_settings(db)
    if not merged.article_archive_enabled:
        return 0

    cutoff = datetime.now(UTC) - timedelta(days=merged.article_retention_days)
    stale = (
        db.query(Article)
        .filter(
            Article.archived_at.is_(None),
            db_or(
                Article.ingested_at < cutoff,
                db_and(Article.published_at.isnot(None), Article.published_at < cutoff),
            ),
        )
        .all()
    )
    now = datetime.now(UTC)
    for article in stale:
        article.archived_at = now
    if stale:
        db.commit()
        logger.info(
            "Archived %d article(s) older than %d-day retention",
            len(stale),
            merged.article_retention_days,
        )
    return len(stale)


def expire_stale_review_articles(db: Session) -> int:
    """
    Soft-expire review-queue rows older than the active evidence window.

    Stale review items become ``skipped`` and get ``archived_at`` so Collection
    and the Review page (``archive=active``) no longer show them. No LLM rerun.
    """
    merged = merge_pipeline_settings(db)
    if not merged.article_archive_enabled:
        return 0

    evidence_days = merged.trend_window_days + merged.trend_prior_window_days
    cutoff = datetime.now(UTC) - timedelta(days=evidence_days)
    candidates = db.query(Article).filter(Article.status == ArticleStatus.review).all()
    stale = [article for article in candidates if article_coverage_datetime(article) < cutoff]
    now = datetime.now(UTC)
    note = f"Expired from review after {evidence_days}-day evidence window."
    for article in stale:
        article.status = ArticleStatus.skipped
        if article.archived_at is None:
            article.archived_at = now
        existing = (article.review_notes or "").rstrip()
        article.review_notes = f"{existing}\n{note}" if existing else note
    if stale:
        db.commit()
        logger.info(
            "Expired %d review article(s) older than %d-day evidence window",
            len(stale),
            evidence_days,
        )
    return len(stale)
