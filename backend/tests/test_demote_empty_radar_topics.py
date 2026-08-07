"""PULSE-027: radar topics without active articles leave the live radar for watchlist review."""

from __future__ import annotations

from datetime import UTC, datetime

from backend.models.article import Article, ArticleStatus
from backend.models.source import Source, SourceType
from backend.models.topic import TopicStatus
from backend.services.signal_service import demote_radar_topics_without_articles
from backend.tests.domain_fixtures import make_topic


def _source(db_session) -> Source:
    source = db_session.query(Source).first()
    if source is None:
        source = Source(name="Test", url="https://example.com/rss", type=SourceType.rss)
        db_session.add(source)
        db_session.flush()
    return source


def _article(db_session, *, topic_id: int, archived: bool = False) -> Article:
    now = datetime.now(UTC)
    article = Article(
        source_id=_source(db_session).id,
        topic_id=topic_id,
        title="Supporting story",
        url=f"https://example.com/story-{topic_id}-{archived}",
        content="Technology identity access controls",
        published_at=now,
        ingested_at=now,
        status=ArticleStatus.processed,
        archived_at=now if archived else None,
    )
    db_session.add(article)
    db_session.flush()
    return article


def test_demote_published_topic_with_no_active_articles(db_session):
    empty = make_topic(
        db_session,
        name="Identity and access",
        domain_slug="security",
        subdomain="empty-dup",
        status=TopicStatus.pending,
        is_published=True,
        urgency_score=8.8,
    )
    _article(db_session, topic_id=empty.id, archived=True)
    with_articles = make_topic(
        db_session,
        name="Identity and access",
        domain_slug="security",
        subdomain="canonical",
        status=TopicStatus.watched,
        is_published=True,
        urgency_score=10.0,
    )
    _article(db_session, topic_id=with_articles.id, archived=False)
    db_session.commit()

    n = demote_radar_topics_without_articles(db_session)

    db_session.refresh(empty)
    db_session.refresh(with_articles)
    assert n == 1
    assert empty.is_published is False
    assert empty.status == TopicStatus.watched
    assert empty.selected_at is None
    assert with_articles.is_published is True
    assert with_articles.status == TopicStatus.watched


def test_demote_selected_topic_with_zero_articles(db_session):
    selected = make_topic(
        db_session,
        name="Empty selected theme",
        domain_slug="ai",
        status=TopicStatus.selected,
        is_published=False,
        selected_at=datetime.now(UTC),
        urgency_score=7.0,
    )
    db_session.commit()

    n = demote_radar_topics_without_articles(db_session)

    db_session.refresh(selected)
    assert n == 1
    assert selected.status == TopicStatus.watched
    assert selected.is_published is False
    assert selected.selected_at is None


def test_publish_rejects_topic_without_active_articles(client, db_session):
    topic = make_topic(
        db_session,
        name="No evidence yet",
        domain_slug="security",
        status=TopicStatus.selected,
        is_published=False,
        urgency_score=6.0,
    )
    db_session.commit()

    login = client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": "pulseadmin"},
    )
    assert login.status_code == 200

    res = client.post(f"/api/admin/topics/{topic.id}/publish")
    assert res.status_code == 400
    assert "article" in res.json()["detail"].lower()

    db_session.refresh(topic)
    assert topic.is_published is False


def test_public_published_topics_omit_empty_published_rows(client, db_session):
    empty = make_topic(
        db_session,
        name="Empty published",
        domain_slug="security",
        subdomain="empty",
        status=TopicStatus.pending,
        is_published=True,
        urgency_score=9.0,
    )
    live = make_topic(
        db_session,
        name="Live with stories",
        domain_slug="security",
        subdomain="live",
        status=TopicStatus.watched,
        is_published=True,
        urgency_score=8.0,
    )
    _article(db_session, topic_id=live.id)
    db_session.commit()

    res = client.get("/api/topics/published")
    assert res.status_code == 200
    names = {row["name"] for row in res.json()}
    assert "Live with stories" in names
    assert "Empty published" not in names
    assert empty.id not in {row["id"] for row in res.json()}
