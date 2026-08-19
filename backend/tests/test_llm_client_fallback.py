"""Provider failover: DeepSeek billing errors skip retries and use backup models."""

from unittest.mock import MagicMock

from openai import APIStatusError


def _status_error(code: int, message: str) -> APIStatusError:
    resp = MagicMock()
    resp.status_code = code
    resp.headers = {}
    return APIStatusError(message, response=resp, body={"error": {"message": message}})


def test_deepseek_billing_error_does_not_retry_json_mode(monkeypatch):
    from backend.services import llm_client as lc

    lc.reset_provider_circuits()
    client = MagicMock()
    client.chat.completions.create.side_effect = _status_error(402, "Insufficient Balance")
    monkeypatch.setattr(lc, "_get_openai_client", lambda: client)

    try:
        lc._complete_deepseek(
            "deepseek-v4-pro",
            system="sys",
            user="hi",
            max_tokens=32,
            json_response=True,
        )
        raise AssertionError("expected billing error")
    except APIStatusError as exc:
        assert exc.status_code == 402
    assert client.chat.completions.create.call_count == 1


def test_chat_completion_uses_openai_when_deepseek_and_anthropic_are_broke(monkeypatch):
    from backend.services import llm_client as lc

    lc.reset_provider_circuits()

    def boom_deepseek(*_a, **_k):
        raise _status_error(402, "Insufficient Balance")

    class BrokeAnthropic(Exception):
        pass

    # anthropic.APIError is what chat_completion_result catches
    import anthropic

    def boom_anthropic(*_a, **_k):
        raise anthropic.APIError(
            "credit balance is too low",
            request=MagicMock(),
            body={"error": {"message": "credit balance is too low"}},
        )

    monkeypatch.setattr(lc, "_deepseek_configured", lambda: True)
    monkeypatch.setattr(lc, "_anthropic_configured", lambda: True)
    monkeypatch.setattr(lc, "_openai_chat_configured", lambda: True)
    monkeypatch.setattr(lc, "_complete_deepseek", boom_deepseek)
    monkeypatch.setattr(lc, "_complete_anthropic", boom_anthropic)
    monkeypatch.setattr(
        lc,
        "_complete_openai_chat",
        lambda *a, **k: ('{"relevant": true}', "gpt-4o-mini", 9),
    )

    result = lc.chat_completion_result(
        "deepseek-v4-pro",
        system="sys",
        user="hi",
        max_tokens=32,
        json_response=True,
    )
    assert result.model_id == "gpt-4o-mini"
    assert "relevant" in result.text


def test_second_call_skips_deepseek_after_billing_circuit(monkeypatch):
    from backend.services import llm_client as lc

    lc.reset_provider_circuits()
    deepseek_calls = {"n": 0}

    def boom_deepseek(*_a, **_k):
        deepseek_calls["n"] += 1
        raise _status_error(402, "Insufficient Balance")

    monkeypatch.setattr(lc, "_deepseek_configured", lambda: True)
    monkeypatch.setattr(lc, "_anthropic_configured", lambda: False)
    monkeypatch.setattr(lc, "_openai_chat_configured", lambda: True)
    monkeypatch.setattr(lc, "_complete_deepseek", boom_deepseek)
    monkeypatch.setattr(
        lc,
        "_complete_openai_chat",
        lambda *a, **k: ("ok", "gpt-4o-mini", 3),
    )

    first = lc.chat_completion_result("deepseek-v4-pro", system="s", user="u", max_tokens=8)
    second = lc.chat_completion_result("deepseek-v4-pro", system="s", user="u", max_tokens=8)
    assert first.text == "ok" and second.text == "ok"
    assert deepseek_calls["n"] == 1
