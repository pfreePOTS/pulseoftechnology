"""Cloudflare Turnstile siteverify for the public contact form."""

from __future__ import annotations

import logging

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
_ENFORCED_ENVIRONMENTS = frozenset({"production", "staging"})


def verify_turnstile_token(token: str | None, remote_ip: str | None) -> bool:
    """Return True when the contact submission may proceed.

    Development with an empty secret skips the check so local and pytest
    runs work before a widget is configured. Staging and production fail
    closed when the secret is missing. A configured secret always requires
    a token that Cloudflare accepts.
    """
    secret = (settings.turnstile_secret_key or "").strip()
    environment = settings.environment.strip().lower()
    if not secret:
        if environment in _ENFORCED_ENVIRONMENTS:
            logger.error("[contact] TURNSTILE_SECRET_KEY is not set")
            return False
        return True

    cleaned = (token or "").strip()
    if not cleaned:
        return False

    payload = {"secret": secret, "response": cleaned}
    if remote_ip:
        payload["remoteip"] = remote_ip
    try:
        response = httpx.post(SITEVERIFY_URL, data=payload, timeout=5.0)
        body = response.json()
    except Exception:
        logger.exception("[contact] turnstile siteverify request failed")
        return False
    if body.get("success") is True:
        return True
    codes = body.get("error-codes") or []
    logger.info(
        "[contact] turnstile rejected error_codes=%s",
        ",".join(str(code) for code in codes),
    )
    return False
