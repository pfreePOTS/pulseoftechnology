"""Tests for article archive windows."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from backend.models.article import Article, ArticleStatus
from backend.models.source import Source, SourceType
from backend.models.topic import Topic
from backend.services.archive_service import archive_outside_active_evidence_window


def _seed_article(db_session, *, age_days: int, topic: Topic | None = None) -> Article:
    source = db_session.query(Source).first()
    if source is None:
        source = Source(name="Test", url="https://example.com/rss", type=SourceType.rss)
        db_session.add(source)
        db_session.flush()
    when = datetime.now(UTC) - timedelta(days=age_days)
    article = Article(
        source_id=source.id,
        topic_id=topic.id if topic else None,
        title=f"Article {age_days}",
        url=f"https://example.com/{age_days}",
        content="Technology article",
        published_at=when,
        ingested_at=when,
        status=ArticleStatus.processed,
    )
    db_session.add(article)
    db_session.commit()
    db_session.refresh(article)
    return article


def test_archive_outside_active_evidence_window_uses_primary_plus_prior_window(db_session):
    topic = Topic(name="AI Agents", domain="AI", urgency_score=7)
    db_session.add(topic)
    db_session.commit()
    recent = _seed_article(db_session, age_days=10, topic=topic)
    stale = _seed_article(db_session, age_days=15, topic=topic)

    settings = SimpleNamespace(
        article_archive_enabled=True,
        trend_window_days=7,
        trend_prior_window_days=7,
    )
    with patch("backend.services.archive_service.merge_pipeline_settings", return_value=settings):
        archived = archive_outside_active_evidence_window(db_session)

    db_session.refresh(recent)
    db_session.refresh(stale)
    assert archived == 1
    assert recent.archived_at is None
    assert stale.archived_at is not None


def test_archive_outside_active_evidence_window_only_archives_linked_articles(db_session):
    unlinked_old = _seed_article(db_session, age_days=20, topic=None)

    settings = SimpleNamespace(
        article_archive_enabled=True,
        trend_window_days=7,
        trend_prior_window_days=7,
    )
    with patch("backend.services.archive_service.merge_pipeline_settings", return_value=settings):
        archived = archive_outside_active_evidence_window(db_session)

    db_session.refresh(unlinked_old)
    assert archived == 0
    assert unlinked_old.archived_at is None


def test_archive_outside_active_evidence_window_prefers_published_date_over_fresh_ingest(
    db_session,
):
    topic = Topic(name="AI Agents", domain="AI", urgency_score=7)
    source = Source(name="Backlog Feed", url="https://example.com/backlog", type=SourceType.rss)
    db_session.add_all([topic, source])
    db_session.commit()
    old_publish = datetime.now(UTC) - timedelta(days=20)
    fresh_ingest = datetime.now(UTC)
    article = Article(
        source_id=source.id,
        topic_id=topic.id,
        title="Old article ingested today",
        url="https://example.com/backlog-old",
        content="Technology article",
        published_at=old_publish,
        ingested_at=fresh_ingest,
        status=ArticleStatus.processed,
    )
    db_session.add(article)
    db_session.commit()

    settings = SimpleNamespace(
        article_archive_enabled=True,
        trend_window_days=7,
        trend_prior_window_days=7,
    )
    with patch("backend.services.archive_service.merge_pipeline_settings", return_value=settings):
        archived = archive_outside_active_evidence_window(db_session)

    db_session.refresh(article)
    assert archived == 1
    assert article.archived_at is not None
