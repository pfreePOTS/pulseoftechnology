"""Global hot-of-day: same lead for everyone, no day-over-day topic repeat."""

from datetime import UTC, datetime, timedelta

from backend.models.article import Article, ArticleStatus
from backend.models.source import Source, SourceType
from backend.models.topic import TopicStatus
from backend.services.pipeline_settings import upsert_site_config
from backend.services.trend_service import HOT_OF_DAY_HISTORY_KEY, build_hot_of_day
from backend.tests.domain_fixtures import make_topic


def _source(db_session) -> Source:
    source = db_session.query(Source).first()
    if source is None:
        source = Source(name="Wire", url="https://example.com/rss", type=SourceType.rss)
        db_session.add(source)
        db_session.flush()
    return source


def _article(db_session, *, topic_id: int, title: str, ingested_at: datetime) -> Article:
    article = Article(
        source_id=_source(db_session).id,
        topic_id=topic_id,
        title=title,
        url=f"https://example.com/{topic_id}/{title.replace(' ', '-')}",
        content="Enterprise technology briefing",
        published_at=ingested_at,
        ingested_at=ingested_at,
        status=ArticleStatus.processed,
    )
    db_session.add(article)
    db_session.flush()
    return article


def _selected(db_session, *, name: str, domain_slug: str, urgency: float):
    return make_topic(
        db_session,
        name=name,
        domain_slug=domain_slug,
        subdomain="ops",
        status=TopicStatus.selected,
        urgency_score=urgency,
        is_published=True,
    )


def test_hot_of_day_skips_yesterdays_topic_and_locks_today(db_session):
    day = datetime(2026, 8, 16, 17, 0, tzinfo=UTC)
    security = _selected(
        db_session, name="Security operations", domain_slug="security", urgency=10.0
    )
    cloud = _selected(db_session, name="Cloud spend", domain_slug="cloud", urgency=8.0)
    for i in range(3):
        _article(
            db_session,
            topic_id=security.id,
            title=f"Sec story {i}",
            ingested_at=day - timedelta(hours=i + 1),
        )
    _article(
        db_session,
        topic_id=cloud.id,
        title="Cloud story",
        ingested_at=day - timedelta(hours=2),
    )
    db_session.commit()

    upsert_site_config(
        db_session,
        {
            HOT_OF_DAY_HISTORY_KEY: [
                {"date": "2026-08-15", "topic_id": security.id, "article_id": None},
            ]
        },
    )

    first = build_hot_of_day(db_session, now=day)
    assert first["hot_topic"]["id"] == cloud.id
    assert first["hot_article"]["title"] == "Cloud story"

    # Highest-count topic is still Security — today's lock must hold.
    again = build_hot_of_day(db_session, now=day)
    assert again["hot_topic"]["id"] == cloud.id


def test_hot_of_day_repeats_only_when_no_other_selected_topic_has_coverage(db_session):
    day = datetime(2026, 8, 16, 17, 0, tzinfo=UTC)
    only = _selected(db_session, name="Only radar theme", domain_slug="ai", urgency=9.0)
    _article(db_session, topic_id=only.id, title="Solo", ingested_at=day - timedelta(hours=1))
    db_session.commit()
    upsert_site_config(
        db_session,
        {HOT_OF_DAY_HISTORY_KEY: [{"date": "2026-08-15", "topic_id": only.id, "article_id": None}]},
    )

    hot = build_hot_of_day(db_session, now=day)
    assert hot["hot_topic"]["id"] == only.id
    assert hot["hot_article"]["title"] == "Solo"
