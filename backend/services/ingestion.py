import logging
from datetime import UTC, datetime
from typing import Any

import feedparser
import httpx
from bs4 import BeautifulSoup
from langdetect import DetectorFactory, detect_langs
from langdetect.lang_detect_exception import LangDetectException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from ..models.article import Article, ArticleStatus
from ..models.source import Source
from ..models.topic import Topic
from ..services.ai_service import process_raw_articles
from ..services.article_language import contains_non_latin_script
from ..services.vector_service import upsert_article

logger = logging.getLogger(__name__)

DetectorFactory.seed = 0  # deterministic language detection

_RSS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; PulseOfTechnology/1.0; +https://pulseone.com) RSS-Ingestion"
    ),
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
}

# Headers + caps used when we have to scrape the article page for an Open Graph
# image because the RSS entry itself shipped no media (TechCrunch and Bleeping
# Computer feeds, for example, omit thumbnails entirely).
_OG_SCRAPE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; PulseOfTechnology/1.0; +https://pulseone.com) RSS-Ingestion"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
# OG/Twitter meta tags live in <head>; 256 KB is plenty and keeps a single
# slow article from blowing the ingestion job's memory or wall-clock budget.
_OG_SCRAPE_MAX_BYTES = 256 * 1024
_OG_SCRAPE_TIMEOUT = 4.0
# Per-tick cap so a backlog of image-less articles can never starve the
# scheduler. Tuned so worst case (cap × timeout) stays well under one minute.
_OG_BACKFILL_PER_TICK = 25
# Higher cap for operator-triggered manual runs (admin → System Jobs button).
# Still bounded so even a fully image-less DB clears in a few minutes per click
# instead of holding a single background task open for an unbounded stretch.
_OG_BACKFILL_PER_MANUAL_RUN = 200


def _fetch_rss_body(url: str) -> bytes | None:
    """Fetch feed bytes with browser-like headers (many sites block default urllib)."""
    try:
        with httpx.Client(timeout=45.0, follow_redirects=True) as client:
            r = client.get(url, headers=_RSS_HEADERS)
            r.raise_for_status()
            return r.content
    except Exception as e:
        logger.debug("RSS HTTP fetch failed for %s (%s); using feedparser default fetch", url, e)
        return None


def _strip_html(raw: str | None) -> str | None:
    """Strip HTML tags from a string, returning plain text."""
    if not raw:
        return None
    return BeautifulSoup(raw, "lxml").get_text(separator=" ", strip=True)


def _scrape_og_image(article_url: str) -> str | None:
    """Best-effort `og:image` / `twitter:image` lookup for `article_url`.

    Used as a fallback when the RSS entry itself carries no usable thumbnail —
    common for lean feeds like TechCrunch and Bleeping Computer. Soft-failing
    by design: any network or parse error is swallowed so an unreachable
    outlet can never break the hourly ingestion job. We cap the read size and
    the request timeout aggressively because the meta tags we care about are
    always in `<head>` and the only consumer (the radar story cards) renders
    a domain-colour gradient when this returns `None`."""
    if not article_url or not article_url.lower().startswith(("http://", "https://")):
        return None
    try:
        with httpx.Client(
            timeout=_OG_SCRAPE_TIMEOUT,
            follow_redirects=True,
            headers=_OG_SCRAPE_HEADERS,
        ) as client:
            resp = client.get(article_url)
            resp.raise_for_status()
            content_type = resp.headers.get("Content-Type", "") or ""
            if "html" not in content_type.lower():
                return None
            body = resp.content[:_OG_SCRAPE_MAX_BYTES]
        soup = BeautifulSoup(body, "lxml")
        for attrs in (
            {"property": "og:image"},
            {"name": "og:image"},
            {"property": "og:image:url"},
            {"property": "og:image:secure_url"},
            {"property": "twitter:image"},
            {"name": "twitter:image"},
            {"property": "twitter:image:src"},
            {"name": "twitter:image:src"},
        ):
            tag = soup.find("meta", attrs=attrs)
            if tag and tag.get("content"):
                u = str(tag["content"]).strip()
                if u.startswith(("http://", "https://")):
                    return u[:2048]
    except Exception:
        logger.debug("OG image scrape failed for %s", article_url, exc_info=True)
    return None


def _rss_image_url_from_entry(entry: Any) -> str | None:
    """Best-effort lead image from RSS/Atom (media_thumbnail, enclosure, media_content, first img)."""
    try:
        mt = getattr(entry, "media_thumbnail", None)
        if mt:
            first = mt[0] if isinstance(mt, list) else mt
            if isinstance(first, dict) and first.get("url"):
                u = str(first["url"]).strip()
                if u:
                    return u[:2048]
        for link in entry.get("links", []) or []:
            if not isinstance(link, dict):
                continue
            rel = (link.get("rel") or "").lower()
            typ = (link.get("type") or "").lower()
            if rel == "enclosure" or typ.startswith("image/"):
                href = link.get("href")
                if href:
                    u = str(href).strip()
                    if u:
                        return u[:2048]
        mc = entry.get("media_content") or []
        if mc and isinstance(mc[0], dict) and mc[0].get("url"):
            u = str(mc[0]["url"]).strip()
            if u:
                return u[:2048]
        raw = None
        contents = entry.get("content")
        if contents and isinstance(contents, list) and contents:
            raw = contents[0].get("value") if isinstance(contents[0], dict) else None
        if not raw:
            raw = entry.get("summary")
        if raw:
            soup = BeautifulSoup(raw, "lxml")
            im = soup.find("img")
            if im and im.get("src"):
                u = str(im["src"]).strip()
                if u:
                    return u[:2048]
    except Exception:
        logger.debug("RSS image extraction failed for entry", exc_info=True)
    return None


def _parse_published(entry: feedparser.FeedParserDict) -> datetime | None:
    """Parse published_parsed struct_time from a feed entry into a UTC datetime."""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        import time

        ts = time.mktime(entry.published_parsed)
        return datetime.fromtimestamp(ts, tz=UTC)
    return None


# Below this character count, langdetect is unreliable enough on tech headlines /
# acronym-heavy English text that a "non-English" verdict is essentially noise.
# We keep such items and let the AI gate sort them out semantically.
_LANG_DETECT_MIN_SAMPLE = 80
# Probability threshold for the top non-English language to count as a confident
# rejection. Below this, we treat the verdict as too uncertain and keep the item.
_LANG_DETECT_REJECT_THRESHOLD = 0.90


def _is_english_for_ingest(title: str, plain_content: str | None) -> bool:
    """
    Return True if this RSS item should be kept for English-only ingestion.

    Goal is "block non-English articles," not "reject anything langdetect is
    unsure about." We therefore lean toward keep:

    * Hard reject only when the title or the title+content sample contains a
      script that's unambiguously non-English (CJK, Hangul, Cyrillic, Arabic, …).
    * Run ``langdetect`` only on a sample long enough to be reliable, and only
      reject when its top guess is non-English with high confidence.
    * Otherwise: keep. Short English-only headlines and acronym-heavy tech
      copy stay in.
    """
    t = (title or "").strip()
    if not t:
        return False
    sample = f"{t} {plain_content or ''}".strip()
    if contains_non_latin_script(t) or contains_non_latin_script(sample):
        return False
    if len(sample) < _LANG_DETECT_MIN_SAMPLE:
        return True
    try:
        results = detect_langs(sample)
    except LangDetectException:
        return True
    if not results:
        return True
    top = results[0]
    if getattr(top, "lang", None) == "en":
        return True
    return float(getattr(top, "prob", 0.0)) < _LANG_DETECT_REJECT_THRESHOLD


def fetch_rss_feed(source: Source, db: Session) -> int:
    """
    Fetch and parse an RSS feed for the given Source, saving new articles.
    Non-English articles are silently skipped.

    Returns the number of new articles inserted.
    """
    logger.info("Fetching RSS feed for source %r (%s)", source.name, source.url)

    feed = None
    body = _fetch_rss_body(source.url)
    if body is not None:
        feed = feedparser.parse(body)
    if feed is None or (feed.bozo and not feed.entries):
        feed = feedparser.parse(source.url)

    if feed.bozo and not feed.entries:
        # Expected when a URL 404s or returns HTML — not worth WARNING-level noise in logs.
        logger.info(
            "RSS skip %r: no entries (%s)",
            source.name,
            feed.bozo_exception or "parse error",
        )
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

        if not _is_english_for_ingest(title, plain_content):
            skipped_lang += 1
            logger.debug("Skipped non-English article: %r", title)
            continue

        # Prefer media advertised by the feed itself; only reach out to the
        # article page when the entry shipped no thumbnail — this keeps the
        # ingestion budget predictable for outlets that already provide one.
        image_url = _rss_image_url_from_entry(entry)
        if not image_url:
            image_url = _scrape_og_image(url)
        article = Article(
            source_id=source.id,
            title=title.strip(),
            url=url,
            image_url=image_url,
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
        except SQLAlchemyError:
            db.rollback()
            raise

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
        db.rollback()
        logger.exception("Error during AI article processing")
    try:
        _embed_processed_articles(db)
    except Exception:
        db.rollback()
        logger.exception("Error during vector embedding — continuing without Pinecone")
    return processed


def backfill_missing_article_images(
    db: Session, *, limit: int = _OG_BACKFILL_PER_MANUAL_RUN
) -> int:
    """Public entry point for the admin "Backfill story images" job.

    Thin wrapper over `_backfill_missing_article_images` so callers outside
    this module don't reach into an underscore-prefixed helper. The default
    `limit` is the larger manual-run cap (operator click) — the hourly tick
    keeps using the smaller per-tick value via `_backfill_missing_article_images`."""
    return _backfill_missing_article_images(db, limit=limit)


def _backfill_missing_article_images(db: Session, *, limit: int = _OG_BACKFILL_PER_TICK) -> int:
    """Scrape `og:image` for tracked-surface articles still missing `image_url`.

    Many feeds (TechCrunch, Bleeping Computer, …) ship lean RSS without media,
    so newly-ingested rows from those sources land with `image_url = NULL` and
    the public "Stories we're tracking" cards fall back to a gradient. We run
    this after the normal ingest pass so image URLs heal one tick at a time
    without ever blocking the new-article path. Capped per tick so a backlog
    can never stretch the scheduler past its 1-hour interval."""
    rows = (
        db.query(Article)
        .join(Topic, Article.topic_id == Topic.id)
        .filter(
            Article.image_url.is_(None),
            Article.archived_at.is_(None),
            Topic.is_published == True,  # noqa: E712
        )
        .order_by(Article.ingested_at.desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return 0
    filled = 0
    for a in rows:
        scraped = _scrape_og_image(a.url)
        if not scraped:
            continue
        a.image_url = scraped
        try:
            db.commit()
            filled += 1
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Failed to persist scraped image for article id=%s", a.id)
    if filled:
        logger.info("Backfilled image_url for %d tracked article(s)", filled)
    return filled


def run_all_sources(db: Session) -> None:
    """Fetch all active RSS sources, ingest their feeds, then run AI processing."""
    sources = db.query(Source).filter(Source.is_active == True).all()  # noqa: E712
    logger.info("Running ingestion for %d active sources", len(sources))
    for source in sources:
        source_name = source.name
        try:
            fetch_rss_feed(source, db)
        except Exception:
            db.rollback()
            logger.exception("Error ingesting source %r", source_name)

    run_article_processing_pipeline(db)

    # Heal image-less rows for sources that don't put thumbnails in their feed
    # (TechCrunch, Bleeping Computer, …). Runs after AI processing so we only
    # backfill rows that are already linked to a published topic.
    try:
        _backfill_missing_article_images(db)
    except Exception:
        db.rollback()
        logger.exception("Error during image backfill pass — continuing")


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
