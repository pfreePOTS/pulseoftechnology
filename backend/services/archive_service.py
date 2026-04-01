"""Archive articles past retention — soft-archive via ``archived_at``."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..models.article import Article
from .pipeline_settings import merge_pipeline_settings

logger = logging.getLogger(__name__)


def archive_old_articles(db: Session) -> int:
    """Set archived_at on articles older than retention. Returns count archived."""
    merged = merge_pipeline_settings(db)
    if not merged.article_archive_enabled:
        return 0

    cutoff = datetime.now(UTC) - timedelta(days=merged.article_retention_days)
    stale = (
        db.query(Article)
        .filter(
            Article.ingested_at < cutoff,
            Article.archived_at.is_(None),
        )
        .all()
    )
    now = datetime.now(UTC)
    for article in stale:
        article.archived_at = now
    if stale:
        db.commit()
        logger.info("Archived %d article(s) older than retention", len(stale))
    return len(stale)
