"""Shared helpers for consistent, grep-friendly operational log lines."""

from __future__ import annotations

import hashlib
import os
from typing import Any

from starlette.requests import Request

from .config import settings

_EMAIL_KV_KEYS = frozenset({"email", "contact_email"})


def kv(**fields: Any) -> str:
    """Render ``key=value`` pairs for inclusion in log messages."""
    parts: list[str] = []
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, bool):
            s = "true" if value else "false"
        elif isinstance(value, (list, tuple, set)):
            s = ",".join(str(v) for v in value if v is not None and str(v).strip())
            if not s:
                continue
        else:
            s = str(value).strip()
            if not s:
                continue
            if key in _EMAIL_KV_KEYS and _should_redact_emails():
                s = redact_email_for_log(s)
        if any(c in s for c in (" ", "\n", "\t", '"')):
            s = s.replace("\n", " ").replace("\t", " ").replace('"', "'")
            s = f'"{s}"'
        parts.append(f"{key}={s}")
    return " ".join(parts)


def _should_redact_emails() -> bool:
    """Prefer explicit ``LOG_REDACT_EMAILS``; else redact outside local/test."""
    if os.environ.get("PULSEONE_TESTING") == "1":
        return bool(getattr(settings, "log_redact_emails", False))
    explicit = getattr(settings, "log_redact_emails", None)
    if explicit is not None:
        return bool(explicit)
    return settings.environment.strip().lower() in {"production", "staging"}


def redact_email_for_log(email: str) -> str:
    """Hash the local-part; keep domain for ops triage without full PII."""
    raw = (email or "").strip().lower()
    if "@" not in raw:
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:10]
        return f"redacted-{digest}"
    local, _, domain = raw.partition("@")
    digest = hashlib.sha256(local.encode("utf-8")).hexdigest()[:10]
    return f"{digest}@{domain}"


def client_ip(request: Request | None) -> str:
    """
    Best-effort client address for ops logs.

    When ``TRUST_PROXY_HEADERS`` is true (default in production/staging), use the
    first ``X-Forwarded-For`` hop so Railway / reverse-proxy logs show the browser
    client rather than the proxy hop. Direct ``request.client`` is the fallback.
    """
    if request is None:
        return "unknown"
    if _trust_proxy_headers():
        forwarded = (request.headers.get("x-forwarded-for") or "").strip()
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
        real_ip = (request.headers.get("x-real-ip") or "").strip()
        if real_ip:
            return real_ip
    client = request.client
    if client is None:
        return "unknown"
    return client.host or "unknown"


def _trust_proxy_headers() -> bool:
    explicit = getattr(settings, "trust_proxy_headers", None)
    if explicit is not None:
        return bool(explicit)
    return settings.environment.strip().lower() in {"production", "staging"}
