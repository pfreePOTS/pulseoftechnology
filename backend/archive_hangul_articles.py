"""
Soft-archive articles whose titles contain Hangul (Korean script).

Excludes them from newsletters, velocity counts, and other queries that ignore
archived rows. Safe to run more than once (only touches rows with archived_at IS NULL).

From the project root (recommended):

    docker compose exec backend python -m backend.archive_hangul_articles
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models.article import Article
from .services.article_language import title_contains_hangul


def archive_hangul_titled_articles(db: Session) -> int:
    """Set archived_at on non-archived articles with Hangul in title. Returns count updated."""
    now = datetime.now(UTC)
    n = 0
    rows = db.query(Article).filter(Article.archived_at.is_(None)).all()
    for a in rows:
        if title_contains_hangul(a.title):
            a.archived_at = now
            n += 1
    if n:
        db.commit()
    return n


def main() -> None:
    db = SessionLocal()
    try:
        count = archive_hangul_titled_articles(db)
        print(f"Archived {count} article(s) with Hangul in the title.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
