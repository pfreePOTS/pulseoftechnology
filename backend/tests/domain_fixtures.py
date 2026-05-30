"""Test helpers — seed domain registry rows into a session."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.domain import Domain, DomainStatus
from backend.services.domain_registry import CORE_DOMAIN_DEFS


def ensure_domains(db: Session) -> dict[str, Domain]:
    """Idempotent upsert of core domain rows; returns slug -> Domain map."""
    out: dict[str, Domain] = {}
    for entry in CORE_DOMAIN_DEFS:
        slug = str(entry["slug"])
        existing = db.query(Domain).filter(Domain.slug == slug).one_or_none()
        status = DomainStatus.hidden.value if slug == "other" else DomainStatus.core.value
        if existing:
            out[slug] = existing
            continue
        row = Domain(
            slug=slug,
            label=str(entry["label"]),
            short_label=str(entry["short_label"]),
            description=str(entry.get("description") or ""),
            color=str(entry["color"]),
            hero_image_url=entry.get("hero_image_url"),  # type: ignore[arg-type]
            status=status,
            sort_order=int(entry.get("sort_order") or 100),
        )
        db.add(row)
        db.flush()
        out[slug] = row
    db.commit()
    return out


def domain_id_for(db: Session, slug: str) -> int:
    ensure_domains(db)
    row = db.query(Domain).filter(Domain.slug == slug).one()
    return row.id


def make_topic(
    db: Session,
    *,
    name: str,
    domain_slug: str = "ai",
    subdomain: str = "",
    **kwargs,
) -> "Topic":
    from backend.models.topic import Topic

    did = domain_id_for(db, domain_slug)
    topic = Topic(name=name, domain_id=did, subdomain=subdomain, **kwargs)
    db.add(topic)
    db.flush()
    return topic
