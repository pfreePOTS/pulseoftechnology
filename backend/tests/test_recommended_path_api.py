"""Public recommended-path API — skip_ai returns deterministic payload without LLM."""

from __future__ import annotations

from backend.models.article import Article, ArticleStatus
from backend.models.source import Source, SourceType
from backend.models.topic import TopicStatus
from backend.tests.domain_fixtures import make_topic


def test_recommended_path_skip_ai_has_experience_and_synthesis(client):
    r = client.get(
        "/api/recommended-path",
        params={"industry": "Energy", "role": "COO", "skip_ai": True},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("headline")
    assert data.get("synthesis")
    assert (data.get("synthesis_html") or "").strip()
    items = data.get("experience_items") or []
    assert len(items) >= 1
    assert all(
        str(it.get("title", "")).strip() and str(it.get("description", "")).strip() for it in items
    )
    assert all(str(it.get("icon", "")).strip() for it in items)
    cards = data.get("synthesis_cards") or []
    assert len(cards) == 4
    assert [str(c.get("title", "")) for c in cards] == [
        "Understand",
        "Recommend",
        "Implement",
        "Manage",
    ]
    for ws in data.get("watch_stories") or []:
        assert "image_url" in ws
    assert len(data.get("watch_stories") or []) <= 3
    assert data.get("engagement_examples") == []


def test_recommended_path_skip_ai_does_not_set_hero_urls(client):
    r = client.get(
        "/api/recommended-path",
        params={"industry": "Energy", "role": "COO", "skip_ai": True},
    )
    assert r.status_code == 200, r.text
    for card in r.json().get("synthesis_cards") or []:
        assert card.get("hero_image_url") is None


def test_recommended_path_skip_ai_remote_stage_surfaces_operational_cards(client):
    r = client.get(
        "/api/recommended-path",
        params={
            "industry": "Education",
            "role": "CFO",
            "issue": "Microsoft license management",
            "stage": "We're looking for support for our remote offices.",
            "skip_ai": True,
        },
    )
    assert r.status_code == 200, r.text
    blob = " ".join(
        str(it.get("title", "")) for it in (r.json().get("experience_items") or [])
    ).lower()
    assert "remote" in blob or "help desk" in blob or "monitoring" in blob


def test_recommended_path_skip_ai_restaurant_remote_support_in_scope(client):
    r = client.get(
        "/api/recommended-path",
        params={
            "industry": "Hospitality",
            "role": "COO",
            "issue": "IT Management",
            "stage": "Remote support for our restaurants.",
            "skip_ai": True,
        },
    )
    assert r.status_code == 200, r.text
    blob = " ".join(
        str(it.get("title", "")) + " " + str(it.get("description", ""))
        for it in (r.json().get("experience_items") or [])
    ).lower()
    assert "remote" in blob or "multi-site" in blob or "help desk" in blob


def test_recommended_path_defer_articles_omits_watch_rows(client):
    r = client.get(
        "/api/recommended-path",
        params={
            "industry": "Energy",
            "role": "COO",
            "skip_ai": True,
            "defer_articles": True,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json().get("watch_stories") == []


def test_recommended_path_watch_stories_endpoint_returns_shape(client):
    r = client.get("/api/recommended-path/watch-stories", params={"industry": "Education"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "watch_stories" in data
    assert isinstance(data["watch_stories"], list)
    assert len(data["watch_stories"]) <= 3
    for ws in data["watch_stories"]:
        assert "title" in ws and "url" in ws
        assert "image_url" in ws


def test_recommended_path_watch_stories_includes_processed_on_live_topics(client, db_session):
    """Processed ingest on ``is_published`` topics is the live radar pool — not ``published`` status alone."""
    source = Source(name="Feed", url="https://example.com/rp-watch", type=SourceType.rss)
    topic = make_topic(
        db_session,
        name="Cloud, infrastructure, and endpoint management",
        domain_slug="cloud",
        subdomain="SaaS",
        status=TopicStatus.selected,
        is_published=True,
        urgency_score=90.0,
    )
    article = Article(
        source=source,
        topic=topic,
        title="Regional bank migrates core workloads to hybrid cloud",
        url="https://example.com/rp-watch-hybrid-cloud",
        content="The bank modernizes API payment rails, identity, and fraud controls on Azure.",
        status=ArticleStatus.processed,
    )
    db_session.add_all([source, topic, article])
    db_session.commit()

    r = client.get(
        "/api/recommended-path/watch-stories",
        params={
            "industry": "Food Service",
            "role": "IT Manager / Director",
            "issue": "IT Management",
            "stage": "Support our restaurant chain locations",
        },
    )
    assert r.status_code == 200, r.text
    titles = [row["title"] for row in r.json().get("watch_stories") or []]
    assert "Regional bank migrates core workloads to hybrid cloud" in titles


def test_recommended_path_watch_stories_dedupes_same_title(client, db_session):
    """Syndicated duplicates (same title, different URLs) must not appear twice."""
    source = Source(name="Feed", url="https://example.com/rp-dedupe", type=SourceType.rss)
    topic_a = make_topic(
        db_session,
        name="Cloud, infrastructure, and endpoint management",
        domain_slug="cloud",
        subdomain="SaaS",
        status=TopicStatus.selected,
        is_published=True,
        urgency_score=95.0,
    )
    topic_b = make_topic(
        db_session,
        name="Data governance and protection",
        domain_slug="cloud",
        subdomain="Governance",
        status=TopicStatus.selected,
        is_published=True,
        urgency_score=90.0,
    )
    shared_title = "Meta considers becoming a hyperscaler"
    article_a = Article(
        source=source,
        topic=topic_a,
        title=shared_title,
        url="https://example.com/meta-hyperscaler-a",
        content="Cloud capacity story.",
        status=ArticleStatus.processed,
    )
    article_b = Article(
        source=source,
        topic=topic_b,
        title=shared_title,
        url="https://example.com/meta-hyperscaler-b",
        content="Syndicated headline on another topic.",
        status=ArticleStatus.processed,
    )
    db_session.add_all([source, topic_a, topic_b, article_a, article_b])
    db_session.commit()

    r = client.get(
        "/api/recommended-path/watch-stories",
        params={
            "industry": "Education",
            "role": "CFO",
            "issue": "Cloud",
            "stage": "We're looking for support for our remote offices.",
        },
    )
    assert r.status_code == 200, r.text
    stories = r.json().get("watch_stories") or []
    titles = [row["title"] for row in stories]
    assert titles.count(shared_title) <= 1
