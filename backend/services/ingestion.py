import logging
from datetime import datetime, timezone

import feedparser
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..models.article import Article, ArticleStatus
from ..models.source import Source
from ..services.ai_service import process_raw_articles

logger = logging.getLogger(__name__)


def _strip_html(raw: str | None) -> str | None:
    """Strip HTML tags from a string, returning plain text."""
    if not raw:
        return None
    return BeautifulSoup(raw, "lxml").get_text(separator=" ", strip=True)


def _parse_published(entry: feedparser.FeedParserDict) -> datetime | None:
    """Parse published_parsed struct_time from a feed entry into a UTC datetime."""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        import time
        ts = time.mktime(entry.published_parsed)
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    return None


def fetch_rss_feed(source: Source, db: Session) -> int:
    """
    Fetch and parse an RSS feed for the given Source, saving new articles.

    Returns the number of new articles inserted.
    """
    logger.info("Fetching RSS feed for source %r (%s)", source.name, source.url)

    feed = feedparser.parse(source.url)

    if feed.bozo and not feed.entries:
        logger.warning("Failed to parse feed for %r: %s", source.name, feed.bozo_exception)
        return 0

    new_count = 0
    for entry in feed.entries:
        url = entry.get("link")
        title = entry.get("title")

        if not url or not title:
            continue

        # Check for duplicate before attempting insert
        exists = db.query(Article.id).filter(Article.url == url).first()
        if exists:
            continue

        content_raw = (
            entry.get("content", [{}])[0].get("value")
            or entry.get("summary")
        )

        article = Article(
            source_id=source.id,
            title=title.strip(),
            url=url,
            content=_strip_html(content_raw),
            published_at=_parse_published(entry),
            status=ArticleStatus.raw,
        )
        db.add(article)

        try:
            db.commit()
            new_count += 1
            logger.debug("Inserted article: %r", title)
        except IntegrityError:
            # Race condition: another process inserted the same URL
            db.rollback()
            logger.debug("Duplicate skipped (race): %r", url)

    logger.info("Source %r: %d new articles ingested", source.name, new_count)
    return new_count


def run_all_sources(db: Session) -> None:
    """Fetch all active RSS sources, ingest their feeds, then run AI processing."""
    sources = db.query(Source).filter(Source.is_active == True).all()  # noqa: E712
    logger.info("Running ingestion for %d active sources", len(sources))
    for source in sources:
        try:
            fetch_rss_feed(source, db)
        except Exception:
            logger.exception("Error ingesting source %r", source.name)

    # Process all newly-fetched raw articles with AI classification + topic clustering
    try:
        processed = process_raw_articles(db)
        logger.info("AI processing complete: %d articles assigned to topics", processed)
    except Exception:
        logger.exception("Error during AI article processing")
