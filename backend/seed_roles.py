"""
Upsert canonical executive Role rows with tags for newsletter personas.

Re-runnable: updates tags when Role.name already exists.

    docker compose exec backend python -m backend.seed_roles
"""

from __future__ import annotations

from .database import SessionLocal
from .models.role import Role

# Canonical profiles (admin newsletter sandbox); tags drive content matching.
STANDARD_ROLES: list[tuple[str, list[str]]] = [
    (
        "CEO",
        [
            "Strategy",
            "Innovation",
            "M&A",
            "Risk",
            "Leadership",
            "Growth",
            "Workforce",
            "Regulation",
        ],
    ),
    (
        "CFO",
        [
            "Finance",
            "Cost",
            "Risk",
            "Compliance",
            "Investment",
            "Forecasting",
            "Automation",
            "Audit",
        ],
    ),
    (
        "CTO",
        [
            "AI",
            "Cloud",
            "Architecture",
            "Engineering",
            "Security",
            "Platform",
            "Open Source",
        ],
    ),
    (
        "CISO",
        [
            "Security",
            "Compliance",
            "Risk",
            "Identity",
            "Threat",
            "Governance",
            "Zero Trust",
        ],
    ),
    (
        "COO",
        [
            "Operations",
            "Automation",
            "Workforce",
            "Efficiency",
            "Supply Chain",
            "Process",
        ],
    ),
    (
        "CMO",
        [
            "Marketing",
            "AI",
            "Data",
            "Customer",
            "Brand",
            "Analytics",
            "Personalization",
        ],
    ),
]


def seed() -> None:
    db = SessionLocal()
    try:
        added = 0
        updated = 0
        for name, tags in STANDARD_ROLES:
            row = db.query(Role).filter(Role.name == name).first()
            if row:
                row.tags = tags
                updated += 1
            else:
                db.add(Role(name=name, tags=tags))
                added += 1
        db.commit()
        print(f"Roles: added {added}, updated {updated}.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
