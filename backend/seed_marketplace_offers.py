"""
Upsert PulseOne Microsoft Marketplace offers into the Content Library.

Idempotent: matches on title. Sets type=landing_page, on-site PDF URL (``/marketplace-offers/…``),
and focus-area tags (AI, Security, Cloud, …) for newsletter rotation.

    docker compose exec backend python -m backend.seed_marketplace_offers
"""

from __future__ import annotations

from .database import SessionLocal
from .marketplace_offers import (
    MARKETPLACE_OFFERS,
    offer_image_path,
    offer_landing_pdf_path,
    offer_tags,
)
from .models.content import ContentItem


def seed() -> None:
    db = SessionLocal()
    try:
        added = 0
        updated = 0
        for offer in MARKETPLACE_OFFERS:
            asset_id = str(offer["asset_id"])
            title = str(offer["title"])
            summary = str(offer["summary"])
            tags = offer_tags(list(offer["tags"]))  # type: ignore[arg-type]
            image_url = offer_image_path(asset_id)
            pdf_url = offer_landing_pdf_path(asset_id)

            row = db.query(ContentItem).filter(ContentItem.title == title).first()
            if row:
                row.url = pdf_url
                row.type = "landing_page"
                row.summary = summary
                row.image_url = image_url
                row.tags = tags
                row.is_active = True
                updated += 1
            else:
                db.add(
                    ContentItem(
                        title=title,
                        url=pdf_url,
                        type="landing_page",
                        summary=summary,
                        image_url=image_url,
                        tags=tags,
                        is_active=True,
                    )
                )
                added += 1
        db.commit()
        print(
            f"Marketplace offers: added {added}, updated {updated} (of {len(MARKETPLACE_OFFERS)})."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
