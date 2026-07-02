"""Smoke tests for reclassify_articles script."""

from unittest.mock import patch

from backend.models.article import Article, ArticleStatus
from backend.models.source import Source, SourceType
from backend.scripts.reclassify_articles import _dedup_topics
from backend.tests.domain_fixtures import make_topic


def test_dedup_topics_no_op_when_unique(db_session):
    make_topic(db_session, name="Unique topic", domain_slug="ai")
    merges = _dedup_topics(db_session)
    assert merges == 0


def test_classify_only_smoke(db_session):
    from backend.scripts import reclassify_articles as mod

    with patch.object(
        mod, "_node_classify", return_value={"domain": "AI", "subdomain": "LLM Safety", "tags": []}
    ):
        stats = mod._classify_only(db_session)
    assert "articles_reclassified" in stats


def test_classify_only_rebinds_when_domain_change_would_collide(db_session):
    from backend.scripts import reclassify_articles as mod

    source = Source(name="Feed", url="https://example.com/rss", type=SourceType.rss)
    db_session.add(source)
    t1 = make_topic(db_session, name="Space Situational Awareness", domain_slug="ai", subdomain="")
    t2 = make_topic(
        db_session, name="Space Situational Awareness", domain_slug="security", subdomain=""
    )
    a1 = Article(
        source=source,
        topic=t1,
        title="Article one",
        url="https://example.com/1",
        content="Satellite tracking update.",
        status=ArticleStatus.processed,
    )
    a2 = Article(
        source=source,
        topic=t2,
        title="Article two",
        url="https://example.com/2",
        content="Orbital debris monitoring.",
        status=ArticleStatus.processed,
    )
    db_session.add_all([a1, a2])
    db_session.commit()

    classify = {"domain": "compliance", "subdomain": "", "tags": []}
    with patch.object(mod, "_node_classify", return_value=classify):
        mod._classify_only(db_session)

    db_session.refresh(a1)
    db_session.refresh(a2)
    assert a1.topic_id == a2.topic_id
