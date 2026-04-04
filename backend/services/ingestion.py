import logging
from datetime import UTC, datetime

import feedparser
from bs4 import BeautifulSoup
from langdetect import DetectorFactory, detect
from langdetect.lang_detect_exception import LangDetectException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.article import Article, ArticleStatus
from ..models.source import Source
from ..services.ai_service import process_raw_articles
from ..services.vector_service import upsert_article

logger = logging.getLogger(__name__)

DetectorFactory.seed = 0  # deterministic language detection


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
        return datetime.fromtimestamp(ts, tz=UTC)
    return None


def _is_english(text: str) -> bool:
    """Return True if *text* appears to be English (or is too short to tell)."""
    if not text or len(text.strip()) < 20:
        return True  # too short to judge — let it through
    try:
        return detect(text) == "en"
    except LangDetectException:
        return True  # detection failed — don't discard


def fetch_rss_feed(source: Source, db: Session) -> int:
    """
    Fetch and parse an RSS feed for the given Source, saving new articles.
    Non-English articles are silently skipped.

    Returns the number of new articles inserted.
    """
    logger.info("Fetching RSS feed for source %r (%s)", source.name, source.url)

    feed = feedparser.parse(source.url)

    if feed.bozo and not feed.entries:
        logger.warning("Failed to parse feed for %r: %s", source.name, feed.bozo_exception)
        return 0

    new_count = 0
    skipped_lang = 0
    for entry in feed.entries:
        url = entry.get("link")
        title = entry.get("title")

        if not url or not title:
            continue

        exists = db.query(Article.id).filter(Article.url == url).first()
        if exists:
            continue

        content_raw = entry.get("content", [{}])[0].get("value") or entry.get("summary")
        plain_content = _strip_html(content_raw)

        sample = f"{title.strip()} {plain_content or ''}"
        if not _is_english(sample):
            skipped_lang += 1
            logger.debug("Skipped non-English article: %r", title)
            continue

        article = Article(
            source_id=source.id,
            title=title.strip(),
            url=url,
            content=plain_content,
            published_at=_parse_published(entry),
            status=ArticleStatus.raw,
        )
        db.add(article)

        try:
            db.commit()
            new_count += 1
            logger.debug("Inserted article: %r", title)
        except IntegrityError:
            db.rollback()
            logger.debug("Duplicate skipped (race): %r", url)

    if skipped_lang:
        logger.info("Source %r: skipped %d non-English article(s)", source.name, skipped_lang)
    logger.info("Source %r: %d new articles ingested", source.name, new_count)
    return new_count


def run_article_processing_pipeline(db: Session) -> int:
    """
    Run AI classification on raw articles and upsert vectors. Does not fetch RSS.
    Use this when raw items exist but were never processed, or after manual intake.
    """
    processed = 0
    try:
        processed = process_raw_articles(db)
        logger.info("AI processing complete: %d articles assigned to topics", processed)
    except Exception:
        logger.exception("Error during AI article processing")
    try:
        _embed_processed_articles(db)
    except Exception:
        logger.exception("Error during vector embedding — continuing without Pinecone")
    return processed


def run_all_sources(db: Session) -> None:
    """Fetch all active RSS sources, ingest their feeds, then run AI processing."""
    sources = db.query(Source).filter(Source.is_active == True).all()  # noqa: E712
    logger.info("Running ingestion for %d active sources", len(sources))
    for source in sources:
        try:
            fetch_rss_feed(source, db)
        except Exception:
            logger.exception("Error ingesting source %r", source.name)

    run_article_processing_pipeline(db)


def _embed_processed_articles(db: Session) -> None:
    """Upsert all processed articles that haven't been embedded yet."""
    from ..models.article import ArticleStatus as _AS  # avoid circular at module level

    # Select processed articles with a topic assigned (embedding needs topic metadata)
    articles = (
        db.query(Article)
        .filter(
            Article.status == _AS.processed,
            Article.topic_id.isnot(None),
        )
        .limit(200)  # batch cap per ingestion run
        .all()
    )
    upserted = sum(1 for a in articles if upsert_article(a))
    if upserted:
        logger.info("Pinecone: upserted %d article vectors", upserted)
