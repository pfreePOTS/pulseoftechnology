"""Regression: DeepSeek json_object sometimes returns blank content — retry once without it."""

from unittest.mock import MagicMock, patch

import pytest


def _fake_response(content: str | None, *, tokens: int = 42):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    usage = MagicMock()
    usage.total_tokens = tokens
    resp.usage = usage
    return resp


@pytest.fixture
def deepseek_fake_key():
    with patch("backend.services.llm_client.settings") as st:
        st.deepseek_api_key = "test-key"
        st.deepseek_base_url = "https://api.deepseek.com"
        st.deepseek_model = "deepseek-v4-pro"
        yield


@pytest.mark.usefixtures("deepseek_fake_key")
def test_complete_deepseek_retries_without_json_when_first_body_empty(monkeypatch):
    from backend.services import llm_client as lc

    calls: list[bool] = []

    def fake_create(**kwargs):
        has_json = "response_format" in kwargs
        calls.append(has_json)
        if has_json:
            return _fake_response("")
        return _fake_response('{"relevant":true,"confidence":0.9}')

    monkeypatch.setattr(lc, "_oai", None)
    client = MagicMock()
    client.chat.completions.create = MagicMock(side_effect=fake_create)
    monkeypatch.setattr(lc, "_get_openai_client", lambda: client)

    text, tok = lc._complete_deepseek(
        "deepseek-v4-pro",
        system="sys",
        user="hi",
        max_tokens=100,
        json_response=True,
    )

    assert calls == [True, False], "must try json_object once then retry without"
    assert '"relevant"' in text
    assert tok == 42
