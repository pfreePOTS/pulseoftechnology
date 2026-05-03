"""
Map admin API paths to page-permission slugs (aligned with frontend nav).

Non-superusers must have at least one matching slug for the longest matching
path prefix. Superusers bypass checks.
"""

from __future__ import annotations

import re

# Slugs match `href` keys in frontend admin nav (see `ADMIN_NAV_HREFS`).
PAGE_SLUG_BY_HREF: dict[str, str] = {
    "/admin/research": "research",
    "/admin/review": "research",
    "/admin": "trending",
    "/admin/trending-daily": "daily_trends",
    "/admin/analysis": "analysis",
    "/admin/publishing": "publishing",
    "/admin/newsletter": "newsletter",
    "/admin/inbox": "inbox",
    "/admin/radar-preview": "radar_preview",
    "/admin/sources": "sources",
    "/admin/subscribers": "subscribers",
    "/admin/hubspot": "hubspot",
    "/admin/roles": "roles",
    "/admin/library": "library",
    "/admin/jobs": "jobs",
    "/admin/ai-performance": "ai_performance",
    "/admin/prompt-lab": "prompt_lab",
    "/admin/settings": "settings",
    "/admin/users": "users",
}

ALL_PAGE_SLUGS: frozenset[str] = frozenset(PAGE_SLUG_BY_HREF.values())

# Slugs that may be assigned to invited non-superusers (admins-only console areas).
SUPERUSER_ONLY_SLUGS: frozenset[str] = frozenset({"users", "settings"})

INVITABLE_PAGE_SLUGS: frozenset[str] = ALL_PAGE_SLUGS - SUPERUSER_ONLY_SLUGS

_LOGIN_EMAIL_LOCAL = re.compile(r"^[a-zA-Z0-9._+-]+$")


def normalize_login_email(raw: str) -> str:
    """Allow `pulseoneadmin` as shorthand for pulseoneadmin@pulseone.local."""
    s = raw.strip().lower()
    if "@" not in s:
        if _LOGIN_EMAIL_LOCAL.match(s):
            return f"{s}@pulseone.local"
        return s
    return s


# Longest prefix first. Value = slug(s) required (user needs at least one).
# `/api/admin/users` and `/api/admin/settings` are superuser-only (handled in auth dependency).
_ADMIN_API_RULES: list[tuple[str, frozenset[str]]] = [
    ("/api/admin/hubspot", frozenset({"hubspot"})),
    ("/api/admin/articles", frozenset({"research"})),
    (
        "/api/admin/topics",
        frozenset(
            {"research", "trending", "daily_trends", "analysis", "publishing", "radar_preview"}
        ),
    ),
    ("/api/admin/trending", frozenset({"trending", "daily_trends"})),
    ("/api/admin/signals", frozenset({"analysis"})),
    ("/api/admin/sources", frozenset({"sources"})),
    ("/api/admin/subscribers", frozenset({"subscribers"})),
    ("/api/admin/roles", frozenset({"roles"})),
    ("/api/admin/content", frozenset({"library"})),
    ("/api/admin/newsletter", frozenset({"newsletter"})),
    # Ratings live in Newsletter context; Newsletter-only admins still need API access via Inbox UX.
    ("/api/admin/inbox", frozenset({"inbox", "newsletter"})),
    ("/api/admin/jobs", frozenset({"jobs"})),
    ("/api/admin/agent-runs", frozenset({"ai_performance"})),
    ("/api/admin/prompt-templates", frozenset({"prompt_lab"})),
    ("/api/admin/prompt-proposals", frozenset({"prompt_lab"})),
]


def is_superuser_only_admin_path(path: str) -> bool:
    return path.startswith("/api/admin/users") or path.startswith("/api/admin/settings")


def is_session_me_endpoint(path: str) -> bool:
    """Profile / password change — any authenticated admin may access."""
    return path.startswith("/api/admin/me")


def required_slugs_for_admin_path(path: str) -> frozenset[str] | None:
    """
    Return required permission slug(s) for this API path, or None if no rule
    (should not happen for protected routes).
    """
    for prefix, slugs in _ADMIN_API_RULES:
        if path == prefix or path.startswith(prefix + "/"):
            return slugs
    return None


def user_may_access_admin_path(path: str, is_superuser: bool, page_permissions: list[str]) -> bool:
    if is_session_me_endpoint(path):
        return True
    if is_superuser_only_admin_path(path):
        return is_superuser
    if is_superuser:
        return True
    required = required_slugs_for_admin_path(path)
    if required is None:
        return False
    allowed = frozenset(page_permissions)
    return bool(required & allowed)
