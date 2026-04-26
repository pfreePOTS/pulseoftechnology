"""Archive articles past retention — soft-archive via ``archived_at``."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_ as db_and
from sqlalchemy import or_ as db_or
from sqlalchemy.orm import Session

from ..models.article import Article
from .pipeline_settings import merge_pipeline_settings

logger = logging.getLogger(__name__)


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
