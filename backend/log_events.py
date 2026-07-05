"""Shared helpers for consistent, grep-friendly operational log lines."""

from __future__ import annotations

from typing import Any

from starlette.requests import Request


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
        if any(c in s for c in (" ", "\n", "\t", '"')):
            s = s.replace("\n", " ").replace("\t", " ").replace('"', "'")
            s = f'"{s}"'
        parts.append(f"{key}={s}")
    return " ".join(parts)


def client_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"
    client = request.client
    if client is None:
        return "unknown"
    return client.host or "unknown"
