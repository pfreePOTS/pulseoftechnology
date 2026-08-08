"""PULSE-001 / PULSE-002: client IP and email redaction in ops logs."""

from __future__ import annotations

from unittest.mock import MagicMock

from backend.log_events import client_ip, kv, redact_email_for_log


def test_client_ip_prefers_first_x_forwarded_for_hop(monkeypatch):
    monkeypatch.setattr(
        "backend.log_events.settings.trust_proxy_headers",
        True,
        raising=False,
    )
    request = MagicMock()
    request.headers = {"x-forwarded-for": "203.0.113.9, 10.0.0.1"}
    request.client = MagicMock(host="10.0.0.1")
    assert client_ip(request) == "203.0.113.9"


def test_client_ip_falls_back_to_direct_client_when_proxy_untrusted(monkeypatch):
    monkeypatch.setattr(
        "backend.log_events.settings.trust_proxy_headers",
        False,
        raising=False,
    )
    request = MagicMock()
    request.headers = {"x-forwarded-for": "203.0.113.9"}
    request.client = MagicMock(host="10.0.0.1")
    assert client_ip(request) == "10.0.0.1"


def test_redact_email_for_log_hashes_local_part():
    out = redact_email_for_log("reader@example.com")
    assert out.endswith("@example.com")
    assert not out.startswith("reader@")
    assert "reader" not in out


def test_kv_redacts_email_keys_when_enabled(monkeypatch):
    monkeypatch.setattr("backend.log_events.settings.log_redact_emails", True, raising=False)
    line = kv(email="reader@example.com", contact_email="pat@example.com", count=1)
    assert "reader@example.com" not in line
    assert "pat@example.com" not in line
    assert "email=" in line
    assert "contact_email=" in line
    assert "count=1" in line
