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


def test_domains_for_intake_strategy_does_not_map_to_ai():
    from backend.routers.public import _domains_for_intake, _domains_for_intake_issue

    assert _domains_for_intake_issue("Strategy") == []
    assert "ai" not in _domains_for_intake("Strategy", "investment and governance")
    assert "ai" not in _domains_for_intake_issue("board leadership culture")
    assert _domains_for_intake_issue("AI") == ["ai"]
    assert "ai" in _domains_for_intake("AI", "planning for AI adoption")


def test_industry_aligned_topic_ids_batches_article_lookup(db_session):
    """PULSE-017: one article query covers many topics that lack grid metadata."""
    from datetime import UTC, datetime, timedelta
    from unittest.mock import patch

    from backend.models.article import Article, ArticleStatus
    from backend.models.source import Source, SourceType
    from backend.models.topic import TopicStatus
    from backend.routers import public as public_mod
    from backend.tests.domain_fixtures import make_topic

    source = Source(name="Feed", url="https://example.com/p017", type=SourceType.rss)
    now = datetime.now(UTC)
    since = now - timedelta(hours=96)
    topics = []
    articles = []
    for i in range(5):
        t = make_topic(
            db_session,
            name=f"Generic theme {i}",
            domain_slug="security" if i % 2 == 0 else "cloud",
            subdomain="Ops",
            status=TopicStatus.selected,
            is_published=True,
            urgency_score=50.0 + i,
            industry_positions=None,
        )
        topics.append(t)
        articles.append(
            Article(
                source=source,
                topic=t,
                title=f"Insurance carriers story {i}" if i == 2 else f"Generic cloud story {i}",
                url=f"https://example.com/p017-{i}",
                content=(
                    "Insurance carriers rebuild claims workflows."
                    if i == 2
                    else "Generic cloud capacity expansion."
                ),
                status=ArticleStatus.processed,
                ingested_at=now,
                published_at=now,
            )
        )
    db_session.add(source)
    db_session.add_all(topics)
    db_session.flush()
    db_session.add_all(articles)
    db_session.commit()

    real_query = db_session.query
    article_queries = {"n": 0}

    def counting_query(model):
        q = real_query(model)
        if model is Article:
            article_queries["n"] += 1
        return q

    with patch.object(db_session, "query", side_effect=counting_query):
        hits = public_mod._industry_aligned_topic_ids(db_session, topics, "Insurance", since=since)

    assert topics[2].id in hits
    assert article_queries["n"] == 1


def test_strategy_intake_prefers_industry_aligned_theme_and_story(client, db_session):
    """Strategy must not collapse to AI when an industry-aligned topic/story exists."""
    from datetime import UTC, datetime

    source = Source(name="Feed", url="https://example.com/rp-industry", type=SourceType.rss)
    ai_topic = make_topic(
        db_session,
        name="AI Agent Enterprise Adoption",
        domain_slug="ai",
        subdomain="Agents",
        status=TopicStatus.selected,
        is_published=True,
        urgency_score=99.0,
    )
    insurance_topic = make_topic(
        db_session,
        name="Insurance cyber and ops modernization",
        domain_slug="security",
        subdomain="Insurance Ops",
        status=TopicStatus.selected,
        is_published=True,
        urgency_score=35.0,
        industry_positions={
            "Insurance": {
                "industry_impact": "Carriers face rising cyber underwriting and claims ops pressure.",
                "risk": "high",
                "adoption_state": "piloting",
            }
        },
    )
    now = datetime.now(UTC)
    ai_article = Article(
        source=source,
        topic=ai_topic,
        title="Meta enters the AI coding wars with Muse Spark",
        url="https://example.com/meta-ai-muse",
        content="Agentic coding assistants expand enterprise AI tooling.",
        status=ArticleStatus.processed,
        ingested_at=now,
        published_at=now,
        image_url="https://example.com/ai.jpg",
    )
    insurance_article = Article(
        source=source,
        topic=insurance_topic,
        title="Insurers harden claims platforms against cyber fraud",
        url="https://example.com/insurance-cyber-claims",
        content=(
            "Insurance carriers are rebuilding claims workflows and identity controls "
            "after a wave of cyber-enabled fraud targeting underwriting desks."
        ),
        status=ArticleStatus.processed,
        ingested_at=now,
        published_at=now,
        image_url="https://example.com/ins.jpg",
        persona_impacts={
            "IT Manager / Director": (
                "IT directors in Insurance must align claims platform controls with underwriting risk."
            )
        },
    )
    db_session.add_all([source, ai_topic, insurance_topic, ai_article, insurance_article])
    db_session.commit()

    themes = client.get(
        "/api/recommended-path",
        params={
            "industry": "Insurance",
            "role": "IT Manager / Director",
            "issue": "Strategy",
            "stage": "investment and governance",
            "skip_ai": True,
            "defer_articles": True,
        },
    )
    assert themes.status_code == 200, themes.text
    theme_names = [t["name"] for t in (themes.json().get("topics") or [])]
    assert "Insurance cyber and ops modernization" in theme_names
    # Industry-aligned theme should appear before pure AI urgency filler when both are present.
    assert theme_names.index("Insurance cyber and ops modernization") < theme_names.index(
        "AI Agent Enterprise Adoption"
    )

    stories = client.get(
        "/api/recommended-path/watch-stories",
        params={
            "industry": "Insurance",
            "role": "IT Manager / Director",
            "issue": "Strategy",
            "stage": "investment and governance",
        },
    )
    assert stories.status_code == 200, stories.text
    titles = [row["title"] for row in stories.json().get("watch_stories") or []]
    assert titles, "expected at least one watch story"
    assert titles[0] == "Insurers harden claims platforms against cyber fraud"
