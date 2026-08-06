"""Regression tests for the interactive synthesis cache (PULSE-023).

The /recommended-path and /everyone builds run while a visitor watches a
spinner. Before the cache, every page view (including reloads of the same
intake) launched a fresh multi-second LLM call, and each call held a pooled DB
connection for its full duration — enough concurrent views exhausted the pool
and 500'd unrelated requests.
"""

import json
from unittest.mock import MagicMock

import pytest

from ..services import ai_service


@pytest.fixture(autouse=True)
def _fresh_cache():
    ai_service.clear_path_synthesis_cache()
    yield
    ai_service.clear_path_synthesis_cache()


def _fake_llm(monkeypatch, calls: list[str]):
    monkeypatch.setattr(ai_service.llm_client, "is_llm_configured", lambda: True)
    payload = json.dumps(
        {
            "headline": "Cloud priorities for COOs in Media & Entertainment",
            "synthesis": "Paragraph one.\n\nParagraph two.",
            "experience_items": [],
        }
    )

    def fake_call(model, system, user, max_tokens, json_response=False, disable_thinking=False):
        assert disable_thinking, "interactive synthesis must not spend budget on reasoning tokens"
        calls.append(model)
        return payload

    monkeypatch.setattr(ai_service, "_call", fake_call)


def test_path_synthesis_reuses_cached_result_for_identical_intake(monkeypatch):
    calls: list[str] = []
    _fake_llm(monkeypatch, calls)
    db = MagicMock()

    first = ai_service.generate_path_synthesis(
        db, "West", "Media & Entertainment", "COO", "Cloud", ""
    )
    second = ai_service.generate_path_synthesis(
        db, "West", "Media & Entertainment", "COO", "Cloud", ""
    )

    assert len(calls) == 1, "identical intake within the TTL must not re-run the LLM"
    assert first["headline"] == second["headline"]
    assert first["synthesis_html"] == second["synthesis_html"]


def test_path_synthesis_different_intake_misses_cache(monkeypatch):
    calls: list[str] = []
    _fake_llm(monkeypatch, calls)
    db = MagicMock()

    ai_service.generate_path_synthesis(db, "West", "Media & Entertainment", "COO", "Cloud", "")
    ai_service.generate_path_synthesis(db, "West", "Healthcare", "COO", "Cloud", "")

    assert len(calls) == 2


def test_path_synthesis_uses_fast_tier_model_and_releases_db_connection(monkeypatch):
    calls: list[str] = []
    _fake_llm(monkeypatch, calls)
    db = MagicMock()

    ai_service.generate_path_synthesis(db, "West", "Media & Entertainment", "COO", "Cloud", "")

    assert calls == ["deepseek-v4-flash"], "interactive synthesis must run on the fast tier"
    assert db.rollback.called, "pooled DB connection must be released before the LLM round-trip"


def test_path_synthesis_failures_are_not_cached(monkeypatch):
    monkeypatch.setattr(ai_service.llm_client, "is_llm_configured", lambda: True)
    calls: list[str] = []

    def broken_call(model, system, user, max_tokens, json_response=False, disable_thinking=False):
        calls.append(model)
        return "not json at all"

    monkeypatch.setattr(ai_service, "_call", broken_call)
    db = MagicMock()

    ai_service.generate_path_synthesis(db, "West", "Media & Entertainment", "COO", "Cloud", "")
    ai_service.generate_path_synthesis(db, "West", "Media & Entertainment", "COO", "Cloud", "")

    assert len(calls) == 2, "fallback results must not be cached; next view retries the provider"


def test_everyone_overview_reuses_cached_result(monkeypatch):
    monkeypatch.setattr(ai_service.llm_client, "is_llm_configured", lambda: True)
    calls: list[str] = []
    payload = json.dumps({"headline": "H", "synthesis": "S1.\n\nS2."})

    def fake_call(model, system, user, max_tokens, json_response=False, disable_thinking=False):
        calls.append(model)
        return payload

    monkeypatch.setattr(ai_service, "_call", fake_call)

    topic = MagicMock()
    topic.name = "Agentic rollouts"
    topic.domain = "ai"
    topic.urgency_score = 8.0
    topic.summary = "Everyone is piloting agents."

    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
        topic
    ]

    first = ai_service.generate_everyone_overview(db)
    second = ai_service.generate_everyone_overview(db)

    assert len(calls) == 1
    assert first == second
