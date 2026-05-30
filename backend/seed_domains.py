"""
Seed the domains registry with core PulseOne radar pillars.

Re-runnable: upserts by slug.

Run from inside Docker:
    docker compose exec backend python -m backend.seed_domains
"""

from datetime import UTC, datetime

from .database import SessionLocal
from .models.domain import Domain, DomainStatus
from .services.domain_registry import CORE_DOMAIN_DEFS


def seed() -> None:
    db = SessionLocal()
    try:
        added = 0
        updated = 0
        now = datetime.now(UTC)

        for entry in CORE_DOMAIN_DEFS:
            slug = str(entry["slug"])
            existing = db.query(Domain).filter(Domain.slug == slug).one_or_none()
            status = DomainStatus.hidden.value if slug == "other" else DomainStatus.core.value

            if existing:
                existing.label = str(entry["label"])
                existing.short_label = str(entry["short_label"])
                existing.description = str(entry.get("description") or "")
                existing.color = str(entry["color"])
                existing.hero_image_url = entry.get("hero_image_url")  # type: ignore[assignment]
                existing.sort_order = int(entry.get("sort_order") or 100)
                if existing.status not in (
                    DomainStatus.active.value,
                    DomainStatus.candidate.value,
                    DomainStatus.deprecated.value,
                ):
                    existing.status = status
                existing.updated_at = now
                updated += 1
            else:
                db.add(
                    Domain(
                        slug=slug,
                        label=str(entry["label"]),
                        short_label=str(entry["short_label"]),
                        description=str(entry.get("description") or ""),
                        color=str(entry["color"]),
                        hero_image_url=entry.get("hero_image_url"),  # type: ignore[arg-type]
                        status=status,
                        sort_order=int(entry.get("sort_order") or 100),
                        created_at=now,
                        updated_at=now,
                    )
                )
                added += 1

        db.commit()
        print(f"Seeded {added} new domain(s). Updated {updated} existing domain(s).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
