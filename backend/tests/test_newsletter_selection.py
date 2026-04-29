"""Tests for persona-driven newsletter article ranking."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from ..services.newsletter_selection import (
    NewsletterArticleContext,
    article_industry_bonus,
    score_article_for_newsletter,
    select_articles_for_newsletter_topic,
)


def _article(
    *,
    aid: int = 1,
    title: str = "English headline for tests",
    persona: dict | None = None,
    why: str = "Because it matters.",
    ingested: datetime | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=aid,
        title=title,
        persona_impacts=persona,
        why_it_matters=why,
        what_is_it="x",
        ingested_at=ingested or datetime.now(UTC),
        published_at=None,
        archived_at=None,
    )


def test_article_industry_bonus_matches_case_insensitive():
    art = SimpleNamespace(
        title="Why carriers are watching this trend",
        persona_impacts={"CFO": "Impact for insurance balance sheets."},
        why_it_matters="",
        what_is_it="",
        content="",
        tags=None,
    )
    assert article_industry_bonus(art, "Insurance") > 0
    assert article_industry_bonus(art, "Healthcare") == 0


def test_score_prefers_longer_persona_line_for_same_role():
    ref = datetime.now(UTC)
    ctx = NewsletterArticleContext(role_names=["CFO"], topic_urgency=8.0, reference_time=ref)
    short = _article(persona={"CFO": "Short."}, aid=1)
    long = _article(persona={"CFO": "A" * 200}, aid=2)
    assert score_article_for_newsletter(long, ctx) > score_article_for_newsletter(short, ctx)


def test_score_penalizes_missing_persona_when_role_set():
    ref = datetime.now(UTC)
    ctx = NewsletterArticleContext(role_names=["CFO"], topic_urgency=8.0, reference_time=ref)
    with_p = _article(persona={"CFO": "Substantive impact for the CFO." * 3}, aid=1)
    without = _article(persona={"CTO": "Only for tech"}, aid=2)
    assert score_article_for_newsletter(with_p, ctx) > score_article_for_newsletter(without, ctx)


def test_persona_key_case_insensitive():
    ref = datetime.now(UTC)
    ctx = NewsletterArticleContext(
        role_names=["Chief Financial Officer"], topic_urgency=5.0, reference_time=ref
    )
    a = _article(persona={"chief financial officer": "Match"}, aid=1)
    assert score_article_for_newsletter(a, ctx) > 0


def test_select_excludes_hangul_titles_even_with_strong_persona():
    topic = SimpleNamespace(id=1, name="Topic", urgency_score=9.0)
    korean = _article(
        aid=99,
        title="기업 AI 뉴스",
        persona={"CFO": "Very strong CFO line " * 10},
        why="y",
    )
    english = _article(
        aid=1,
        title="English headline",
        persona={"CFO": "Weaker CFO line"},
        why="y",
    )
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.all.return_value = [korean, english]

    out = select_articles_for_newsletter_topic(
        topic,
        mock_db,
        ["CFO"],
        article_ingested_after=None,
        limit=2,
    )
    assert len(out) == 1
    assert out[0].id == 1


def test_select_prefers_persona_matched_articles():
    topic = SimpleNamespace(id=1, name="Topic", urgency_score=9.0)
    cfo_hit = _article(
        aid=1,
        persona={"CFO": "Detailed CFO-specific narrative " * 5},
        why="y",
    )
    generic = _article(
        aid=2,
        persona={"CTO": "Tech angle only"},
        why="z",
    )

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.all.return_value = [cfo_hit, generic]

    out = select_articles_for_newsletter_topic(
        topic,
        mock_db,
        ["CFO"],
        article_ingested_after=None,
        limit=1,
    )
    assert len(out) == 1
    assert out[0].id == 1


def test_select_fills_from_pool_when_no_persona_for_role():
    topic = SimpleNamespace(id=1, name="T", urgency_score=7.0)
    only_cto = _article(
        aid=1,
        persona={"CTO": "Tech"},
        why="why " * 20,
        ingested=datetime.now(UTC),
    )

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.all.return_value = [only_cto]

    out = select_articles_for_newsletter_topic(
        topic,
        mock_db,
        ["CFO"],
        limit=2,
    )
    assert len(out) == 1


def test_select_includes_article_pending_ai_fields():
    """Linked articles without ``what_is_it`` still appear (e.g. newly attached URLs)."""
    topic = SimpleNamespace(id=1, name="T", urgency_score=7.0)
    pending = SimpleNamespace(
        id=2,
        title="English headline for tests",
        persona_impacts=None,
        why_it_matters="Still matters while summaries are processing.",
        what_is_it=None,
        ingested_at=datetime.now(UTC),
        published_at=None,
        archived_at=None,
    )
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.all.return_value = [pending]

    out = select_articles_for_newsletter_topic(
        topic,
        mock_db,
        None,
        article_ingested_after=None,
        limit=3,
    )
    assert len(out) == 1
    assert out[0].id == 2
