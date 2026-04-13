"""Unit tests for backend/services/ai_service.py."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ..services import ai_service

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_message(text: str) -> MagicMock:
    """Return a minimal mock of an anthropic.types.Message."""
    block = MagicMock()
    block.text = text
    msg = MagicMock()
    msg.content = [block]
    return msg


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
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message(json.dumps(payload))

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            result = ai_service.evaluate_article("OpenAI launches GPT-5 for enterprise.")

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
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message(json.dumps(payload))

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            result = ai_service.evaluate_article("Celebrity spotted at coffee shop.")

        assert result is None

    def test_malformed_json_uses_pipeline_defaults(self):
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message("not json at all")

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            result = ai_service.evaluate_article("Some article text.")

        assert result is not None
        assert result["domain"] == "Other"
        assert result["suggested_topic_name"] == "Other: Review Needed"
        assert result["urgency_score"] == 5.0

    def test_correct_model_used(self):
        payload = {"relevant": False, "domain": "Other", "urgency_score": 1, "reason": "x"}
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message(json.dumps(payload))

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            ai_service.evaluate_article("text")

        call_kwargs = mock_client.messages.create.call_args
        assert call_kwargs.kwargs["model"] == ai_service.HAIKU_MODEL


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
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message(json.dumps(payload))

        topic = self._make_topic()
        articles = self._make_articles()

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            result = ai_service.generate_topic_summary(topic, articles)

        assert "AI adoption accelerated" in result
        assert "Why it matters:" in result
        assert topic.summary == result
        assert topic.newsletter_briefing["what_is_it"] == payload["what_is_it"]
        assert topic.newsletter_briefing["what_to_do"] == payload["what_to_do"]

    def test_empty_articles_returns_empty_string(self):
        topic = self._make_topic()
        result = ai_service.generate_topic_summary(topic, [])
        assert result == ""

    def test_malformed_json_falls_back_to_raw_text(self):
        raw_text = "Some summary without JSON structure."
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message(raw_text)

        topic = self._make_topic()
        articles = self._make_articles()

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            result = ai_service.generate_topic_summary(topic, articles)

        assert result == raw_text
        assert topic.summary == raw_text
        assert topic.newsletter_briefing is None

    def test_correct_model_used(self):
        payload = {"summary": "s", "why_it_matters": "w"}
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message(json.dumps(payload))

        topic = self._make_topic()
        articles = self._make_articles()

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            ai_service.generate_topic_summary(topic, articles)

        call_kwargs = mock_client.messages.create.call_args
        assert call_kwargs.kwargs["model"] == ai_service.SONNET_MODEL

    def test_articles_capped_at_ten(self):
        payload = {"summary": "s", "why_it_matters": "w"}
        mock_client = MagicMock()
        mock_client.messages.create.return_value = _make_message(json.dumps(payload))

        topic = self._make_topic()
        articles = self._make_articles(15)

        with patch.object(ai_service, "_get_client", return_value=mock_client):
            ai_service.generate_topic_summary(topic, articles)

        user_content = mock_client.messages.create.call_args.kwargs["messages"][0]["content"]
        # Only articles 1-10 should appear
        assert "Article 10" in user_content
        assert "Article 11" not in user_content
