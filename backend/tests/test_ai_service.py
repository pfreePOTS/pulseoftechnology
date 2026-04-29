"""Unit tests for backend/services/ai_service.py."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ..models.article import Article, ArticleStatus
from ..models.source import Source, SourceType
from ..models.topic import Topic
from ..services import ai_service

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _patch_prompts():
    """Use built-in fallbacks so tests do not require prompt_templates rows."""
    return patch.object(
        ai_service,
        "get_active_prompt",
        side_effect=lambda _db, name: ai_service._FALLBACK_PROMPTS[name],
    )


def _patch_llm(reply: str):
    """Patch DeepSeek-compatible ``chat_completion`` to return plain text."""
    return patch.object(ai_service.llm_client, "chat_completion", return_value=reply)


# ---------------------------------------------------------------------------
# evaluate_article
# ---------------------------------------------------------------------------


class TestEvaluateArticle:
    def test_relevant_article_returns_dict(self):
        payload = {
            "relevant": True,
            "domain": "AI",
            "urgency_score": 8,
            "reason": "Describes a major AI model launch affecting enterprise strategy.",
        }
        mock_db = MagicMock()

        with _patch_llm(json.dumps(payload)), _patch_prompts():
            result = ai_service.evaluate_article("OpenAI launches GPT-5 for enterprise.", mock_db)

        assert result is not None
        assert result["relevant"] is True
        assert result["domain"] == "AI"
        assert result["urgency_score"] == 8
        assert "reason" in result

    def test_irrelevant_article_returns_none(self):
        payload = {
            "relevant": False,
            "domain": "Other",
            "urgency_score": 1,
            "reason": "Celebrity gossip, not relevant to executives.",
        }
        mock_db = MagicMock()

        with _patch_llm(json.dumps(payload)), _patch_prompts():
            result = ai_service.evaluate_article("Celebrity spotted at coffee shop.", mock_db)

        assert result is None

    def test_malformed_json_uses_pipeline_defaults(self):
        mock_db = MagicMock()

        with _patch_llm("not json at all"), _patch_prompts():
            result = ai_service.evaluate_article("Some article text.", mock_db)

        assert result is not None
        assert result["domain"] == "Other"
        assert result["suggested_topic_name"] == "Other: Review Needed"
        assert result["urgency_score"] == 5.0

    def test_correct_model_used(self):
        payload = {"relevant": False, "domain": "Other", "urgency_score": 1, "reason": "x"}
        mock_db = MagicMock()

        with (
            patch.object(
                ai_service.llm_client, "chat_completion", return_value=json.dumps(payload)
            ) as mock_chat,
            _patch_prompts(),
        ):
            ai_service.evaluate_article("text", mock_db)

        gate_model = mock_chat.call_args_list[0].args[0]
        assert gate_model == ai_service.HAIKU_MODEL


# ---------------------------------------------------------------------------
# Finance subdomain normalization
# ---------------------------------------------------------------------------


class TestFinanceSubdomainNormalization:
    def test_replaces_vague_finance_label_with_tech_investment_bucket(self):
        label = ai_service._normalize_subdomain_label(
            "Finance",
            "Emerging Financial Behaviors",
            "AI startup funding, venture capital valuations, IPO, M&A, and technology investment.",
        )

        assert label == "Tech Investment & Valuations"

    def test_replaces_vague_finance_label_with_digital_payments_bucket(self):
        label = ai_service._normalize_subdomain_label(
            "Finance",
            "Emerging Financial Behaviors",
            "Stablecoin payouts, tokenization, crypto wallets, and digital payment rails.",
        )

        assert label == "Digital Payments & Assets"

    def test_non_finance_subdomain_is_unchanged(self):
        label = ai_service._normalize_subdomain_label(
            "AI",
            "Emerging Financial Behaviors",
            "AI agent adoption and model orchestration.",
        )

        assert label == "Emerging Financial Behaviors"

    def test_reclassifies_legacy_finance_articles_and_subdomains(self, db_session):
        source = Source(name="Legacy", url="https://example.com/legacy", type=SourceType.rss)
        topic = Topic(
            name="Finance",
            domain="Finance",
            subdomain="Emerging Financial Behaviors",
            urgency_score=7,
        )
        bad = Article(
            source=source,
            topic=topic,
            title="Fed holds steady on rates",
            url="https://example.com/fed",
            content="Powell discussed inflation, rates, and macroeconomic policy.",
            status=ArticleStatus.processed,
            published_at=datetime.now(UTC),
        )
        good = Article(
            source=source,
            topic=topic,
            title="AI startup funding wave lifts enterprise software valuations",
            url="https://example.com/ai-funding",
            content="Venture capital, startup funding, valuations, IPO pipelines, and technology investment.",
            status=ArticleStatus.processed,
            published_at=datetime.now(UTC),
        )
        db_session.add_all([source, topic, bad, good])
        db_session.commit()

        result = ai_service.reclassify_legacy_finance_topics(db_session)

        db_session.refresh(topic)
        db_session.refresh(bad)
        db_session.refresh(good)
        assert result == {
            "articles_archived": 1,
            "topics_normalized": 1,
            "articles_normalized": 1,
        }
        assert bad.status == ArticleStatus.skipped
        assert bad.archived_at is not None
        assert good.archived_at is None
        assert good.subdomain == "Tech Investment & Valuations"
        assert topic.subdomain == "Tech Investment & Valuations"

    def test_reclassifies_legacy_leadership_without_tech_signals(self, db_session):
        source = Source(name="Corp", url="https://example.com/l", type=SourceType.rss)
        topic = Topic(
            name="Retail leadership churn",
            domain="Leadership",
            subdomain="General",
            urgency_score=6,
        )
        bad = Article(
            source=source,
            topic=topic,
            title="DEI backlash stresses store leadership benches",
            url="https://example.com/store-dei-leadership",
            subdomain="General",
            content=(
                "Floor supervisors face morale pressure as courtesy expectations and pace targets "
                "clash; shopper complaints and shopfloor squabbles dominate huddles ahead of holiday "
                "rushes—talk centers on schedules and coverage, not modernization playbooks or "
                "board-backed operating model reinvention."
            ),
            status=ArticleStatus.processed,
            published_at=datetime.now(UTC),
        )
        good = Article(
            source=source,
            topic=topic,
            title="Digital transformation rewires regional leadership playbook",
            url="https://example.com/regional-digital-leadership",
            subdomain="General",
            content=(
                "Regional chief information officer aligns Microsoft Teams rollout, Workday changes, "
                "and LMS upskilling for store supervisors adopting zero-trust checkpoints."
            ),
            status=ArticleStatus.processed,
            published_at=datetime.now(UTC),
        )
        db_session.add_all([source, topic, bad, good])
        db_session.commit()

        result = ai_service.reclassify_legacy_leadership_topics(db_session)

        db_session.refresh(topic)
        db_session.refresh(bad)
        db_session.refresh(good)
        assert result == {
            "articles_archived": 1,
            "topics_normalized": 0,
            "articles_normalized": 0,
        }
        assert bad.status == ArticleStatus.skipped
        assert bad.archived_at is not None
        assert good.archived_at is None


# ---------------------------------------------------------------------------
# process_raw_articles
# ---------------------------------------------------------------------------


class TestProcessRawArticles:
    def test_skips_finance_classification_without_technology_signal(self, db_session):
        source = Source(name="Fortune", url="https://example.com/rss", type=SourceType.rss)
        article = Article(
            source=source,
            title="Fed holds steady on rates after Powell press conference",
            url="https://example.com/fed-rates",
            content="The Federal Reserve held interest rates steady while investors watched inflation data.",
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        finance_result = {
            "relevant": True,
            "domain": "Finance",
            "subdomain": "Emerging Financial Behaviors",
            "suggested_topic_name": "Finance",
            "urgency_score": 6,
            "what_is_it": "Central bank policy update",
            "why_it_matters": "Markets are watching rates.",
            "tags": ["rates", "fed"],
        }

        with (
            patch.object(ai_service, "evaluate_article", return_value=finance_result),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        assert processed == 0
        assert article.status == ArticleStatus.skipped
        assert article.topic_id is None
        assert db_session.query(Topic).count() == 0

    def test_processes_finance_classification_with_technology_signal(self, db_session):
        source = Source(name="Industry Wire", url="https://example.com/tech-rss", type=SourceType.rss)
        article = Article(
            source=source,
            title="Bank rolls out API-first core banking platform",
            url="https://example.com/core-banking-platform",
            content="The new platform modernizes payment rails, cloud integration, and fraud controls.",
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        finance_result = {
            "relevant": True,
            "domain": "Finance",
            "subdomain": "Core Banking Modernization",
            "suggested_topic_name": "Core Banking Modernization",
            "urgency_score": 7,
            "what_is_it": "Cloud platform upgrade for banking operations",
            "why_it_matters": "Financial institutions are modernizing legacy systems.",
            "tags": ["api", "payments", "cloud"],
        }

        with (
            patch.object(ai_service, "evaluate_article", return_value=finance_result),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        topic = db_session.query(Topic).one()
        assert processed == 1
        assert article.status == ArticleStatus.processed
        assert article.topic_id == topic.id
        assert topic.domain == "Finance"

    def test_skips_leadership_classification_without_technology_signal(self, db_session):
        source = Source(name="PeopleWire", url="https://example.com/people", type=SourceType.rss)
        article = Article(
            source=source,
            title="Retail leadership under pressure as DEI winds shift",
            url="https://example.com/retail-leadership-hr",
            content=(
                "Regional supervisors shrink supervisory benches; morale dips where labor flare-ups "
                "and storefront etiquette overshadow storefront coaching rhythms—nothing about "
                "rollouts of collaborative chat tools, remediation roadmaps, tabletop resilience "
                "exercises, nor executives steering adoption of new credentialing rules."
            ),
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        leadership_result = {
            "relevant": True,
            "domain": "Leadership",
            "subdomain": "Store dynamics",
            "suggested_topic_name": "Leadership morale",
            "urgency_score": 6,
            "what_is_it": "HR and culture dynamics at storefronts",
            "why_it_matters": "Labor relations shift priorities.",
            "tags": ["retail"],
        }

        with (
            patch.object(ai_service, "evaluate_article", return_value=leadership_result),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        assert processed == 0
        assert article.status == ArticleStatus.skipped
        assert db_session.query(Topic).count() == 0


# ---------------------------------------------------------------------------
# generate_topic_summary
# ---------------------------------------------------------------------------


class TestGenerateTopicSummary:
    def _make_topic(self) -> SimpleNamespace:
        return SimpleNamespace(
            id=1,
            name="AI",
            domain="AI",
            urgency_score=8.0,
            summary=None,
            newsletter_briefing=None,
        )

    def _make_articles(self, n: int = 2) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                id=i + 1,
                title=f"Article {i + 1}: AI breakthrough",
                content=f"Details about AI development number {i + 1}.",
            )
            for i in range(n)
        ]

    def test_summary_saved_to_topic(self):
        payload = {
            "summary": "AI adoption accelerated this quarter.",
            "why_it_matters": "CEOs must plan for workforce changes now.",
            "what_is_it": "Agent tools automate routine decisions.",
            "what_changed": "Enterprise suites shipped integrations.",
            "what_to_do": "Start with a bounded pilot.",
        }

        topic = self._make_topic()
        articles = self._make_articles()

        mock_db = MagicMock()

        with _patch_llm(json.dumps(payload)), _patch_prompts():
            result = ai_service.generate_topic_summary(topic, articles, mock_db)

        assert "AI adoption accelerated" in result
        assert "Why it matters:" in result
        assert topic.summary == result
        assert topic.newsletter_briefing["what_is_it"] == payload["what_is_it"]
        assert topic.newsletter_briefing["what_to_do"] == payload["what_to_do"]

    def test_empty_articles_returns_empty_string(self):
        topic = self._make_topic()
        mock_db = MagicMock()
        result = ai_service.generate_topic_summary(topic, [], mock_db)
        assert result == ""

    def test_malformed_json_falls_back_to_raw_text(self):
        raw_text = "Some summary without JSON structure."
        fallback = "Summary generation failed. Review needed."

        topic = self._make_topic()
        articles = self._make_articles()
        mock_db = MagicMock()

        with _patch_llm(raw_text), _patch_prompts():
            result = ai_service.generate_topic_summary(topic, articles, mock_db)

        assert result == fallback
        assert topic.summary == fallback
        assert topic.newsletter_briefing is None

    def test_correct_model_used(self):
        payload = {"summary": "s", "why_it_matters": "w"}

        topic = self._make_topic()
        articles = self._make_articles()
        mock_db = MagicMock()

        with (
            patch.object(
                ai_service.llm_client, "chat_completion", return_value=json.dumps(payload)
            ) as mock_chat,
            _patch_prompts(),
        ):
            ai_service.generate_topic_summary(topic, articles, mock_db)

        used = mock_chat.call_args_list[0].args[0]
        assert used == ai_service.SONNET_MODEL

    def test_articles_capped_at_ten(self):
        payload = {"summary": "s", "why_it_matters": "w"}

        topic = self._make_topic()
        articles = self._make_articles(15)
        mock_db = MagicMock()

        with (
            patch.object(
                ai_service.llm_client, "chat_completion", return_value=json.dumps(payload)
            ) as mock_chat,
            _patch_prompts(),
        ):
            ai_service.generate_topic_summary(topic, articles, mock_db)

        user_content = mock_chat.call_args_list[0].kwargs["user"]
        assert "Article 10" in user_content
        assert "Article 11" not in user_content
