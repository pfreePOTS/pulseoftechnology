"""Unit tests for backend/services/ai_service.py."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

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
