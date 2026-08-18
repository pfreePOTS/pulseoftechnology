"""PULSE-033: ingest JSON nodes must disable DeepSeek thinking.

V4 Pro reasons by default; those tokens count against max_tokens. The hourly
pipeline only budgets 1024–2048 tokens, so thinking can return empty JSON
(classify/cluster parse len=0) even after the json_object retry.
"""

from unittest.mock import MagicMock, patch

from ..services import ai_service


def _ok(text: str) -> ai_service.llm_client.ChatCompletionResult:
    return ai_service.llm_client.ChatCompletionResult(
        text=text, model_id="deepseek-v4-pro", latency_ms=1, total_tokens=20
    )


def _capture_thinking(monkeypatch, reply: str):
    flags: list[bool] = []

    def fake_ccr(*_a, **kwargs):
        flags.append(bool(kwargs.get("disable_thinking")))
        return _ok(reply)

    monkeypatch.setattr(ai_service.llm_client, "chat_completion_result", fake_ccr)
    return flags


def test_call_result_disables_thinking_for_json_mode(monkeypatch):
    flags = _capture_thinking(monkeypatch, '{"ok": true}')

    ai_service._call_result("deepseek-v4-pro", "sys", "user", 1024, json_response=True)

    assert flags == [True], "json_response completions must not spend the token budget thinking"


def test_ingest_json_nodes_disable_thinking(monkeypatch):
    flags: list[bool] = []

    def fake_ccr(*_a, **kwargs):
        flags.append(bool(kwargs.get("disable_thinking")))
        return _ok(
            '{"relevant":true,"confidence":0.9,"domain":"AI","subdomain":"Models",'
            '"tags":[],"urgency_score":5,"reason":"x","suggested_topic_name":"Models",'
            '"what_is_it":"x","why_it_matters":"y"}'
        )

    monkeypatch.setattr(ai_service.llm_client, "chat_completion_result", fake_ccr)
    monkeypatch.setattr(
        ai_service,
        "get_active_prompt",
        lambda _db, name: ai_service._FALLBACK_PROMPTS[name],
    )
    monkeypatch.setattr(ai_service, "get_active_model", lambda _db, _name: "deepseek-v4-pro")

    db = MagicMock()
    article = "Title: Widget\n\nEnterprise AI briefing."

    with patch("backend.services.optimizer_service.record_agent_run"):
        ai_service._node_gate(db, article, article_id=1)
        ai_service._node_classify(article, "classify-sys", "deepseek-v4-pro", article_id=1)
        ai_service._node_score(article, "score-sys", "deepseek-v4-pro", article_id=1)
        ai_service._node_cluster(db, article, [], domain="AI", subdomain="Models", article_id=1)
        ai_service._node_summarize(
            db, article, domain="AI", topic_name="Models", urgency_score=5.0, article_id=1
        )

    assert flags, "ingest nodes must call the LLM"
    assert all(flags), f"every ingest JSON call must disable thinking; got {flags}"
