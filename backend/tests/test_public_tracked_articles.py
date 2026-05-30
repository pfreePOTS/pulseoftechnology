from datetime import UTC, datetime

from backend.models.article import Article, ArticleStatus
from backend.models.source import Source, SourceType
from backend.models.topic import TopicStatus
from backend.tests.domain_fixtures import make_topic


def test_public_tracked_articles_excludes_archived_articles(client, db_session):
    source = Source(name="Feed", url="https://example.com/rss", type=SourceType.rss)
    topic = make_topic(
        db_session,
        name="Compliance banking",
        domain_slug="compliance",
        subdomain="Tech Investment & Valuations",
        status=TopicStatus.selected,
        is_published=True,
    )
    archived = Article(
        source=source,
        topic=topic,
        title="Tariff refund claims used as collateral",
        url="https://example.com/old-finance",
        content="Retailer tariff refunds and working capital pressure.",
        status=ArticleStatus.published,
        archived_at=datetime.now(UTC),
    )
    active = Article(
        source=source,
        topic=topic,
        title="Bank launches API payment platform",
        url="https://example.com/api-payments",
        content="The banking platform modernizes API payment rails and fraud controls.",
        status=ArticleStatus.published,
    )
    db_session.add_all([source, topic, archived, active])
    db_session.commit()

    response = client.get("/api/articles/tracked")

    assert response.status_code == 200
    titles = [row["title"] for row in response.json()]
    assert titles == ["Bank launches API payment platform"]
