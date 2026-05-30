"""Serialize topic/domain fields for API responses."""

from __future__ import annotations

from ..models.domain import Domain
from ..models.topic import Topic


def topic_domain_short(topic: Topic | object | None) -> str:
    if topic is None:
        return "Other"
    d = getattr(topic, "domain", None)
    if d is None:
        return "Other"
    if isinstance(d, str):
        return d
    short = getattr(d, "short_label", None)
    if short:
        return str(short)
    return "Other"


def topic_domain_slug(topic: Topic | None) -> str:
    if topic is None or topic.domain is None:
        return "other"
    return topic.domain.slug or "other"


def topic_domain_slug_for_filter(topic: object) -> str:
    """Slug for newsletter filtering — accepts ORM topics or test SimpleNamespace."""
    from .domain_registry import slugify_domain

    d = getattr(topic, "domain", None)
    if d is None:
        return ""
    if isinstance(d, str):
        return slugify_domain(d)
    slug = getattr(d, "slug", None)
    if slug:
        return str(slug).lower()
    short = getattr(d, "short_label", None)
    if short:
        return slugify_domain(str(short))
    return ""


def domain_public_payload(domain: Domain | None) -> dict[str, str]:
    if domain is None:
        return {
            "slug": "other",
            "label": "Other Topics",
            "short_label": "Other",
            "color": "#6B7280",
        }
    return {
        "slug": domain.slug,
        "label": domain.label,
        "short_label": domain.short_label,
        "color": domain.color,
    }
