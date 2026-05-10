"""
Copy ``content_items`` rows from one Postgres to another (upsert by ``id`` / UUID).

Preserves IDs so bookmarks and behavior match Dev.

    SOURCE_DATABASE_URL='postgresql://...dev...' \\
    TARGET_DATABASE_URL='postgresql://...staging...' \\
    python -m backend.copy_content_items_between

Or use ``backend.sync_newsletter_cms_between`` to copy **roles** and **content_items** together.
"""

from __future__ import annotations

import os
import sys
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def _require_env(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return v


def _as_uuid(v: object) -> UUID:
    if isinstance(v, UUID):
        return v
    return UUID(str(v))


def copy_content_items(source_url: str, target_url: str) -> tuple[int, int, int]:
    """
    Upsert all content items from source into target.
    Returns (added, updated, source_row_count).
    """
    src_engine = create_engine(source_url)
    tgt_engine = create_engine(target_url)
    TgtSession = sessionmaker(autocommit=False, autoflush=False, bind=tgt_engine)

    with src_engine.connect() as conn:
        rows = (
            conn.execute(
                text(
                    """
                SELECT id, title, url, type, summary, image_url, tags, is_active, created_at
                FROM content_items
                ORDER BY created_at
                """
                )
            )
            .mappings()
            .all()
        )

    if not rows:
        return 0, 0, 0

    from .models.content import ContentItem

    db = TgtSession()
    added = 0
    updated = 0
    try:
        uids = [_as_uuid(r["id"]) for r in rows]
        existing_rows = db.query(ContentItem).filter(ContentItem.id.in_(uids)).all()
        existing_map = {row.id: row for row in existing_rows}

        for r in rows:
            uid = _as_uuid(r["id"])
            row = existing_map.get(uid)
            tags = r["tags"] if r["tags"] is not None else []
            if row:
                row.title = r["title"]
                row.url = r["url"]
                row.type = r["type"]
                row.summary = r["summary"]
                row.image_url = r["image_url"]
                row.tags = list(tags) if not isinstance(tags, list) else tags
                row.is_active = bool(r["is_active"])
                row.created_at = r["created_at"]
                updated += 1
            else:
                db.add(
                    ContentItem(
                        id=uid,
                        title=r["title"],
                        url=r["url"],
                        type=r["type"],
                        summary=r["summary"],
                        image_url=r["image_url"],
                        tags=list(tags) if not isinstance(tags, list) else tags,
                        is_active=bool(r["is_active"]),
                        created_at=r["created_at"],
                    )
                )
                added += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return added, updated, len(rows)


def main() -> None:
    source_url = _require_env("SOURCE_DATABASE_URL")
    target_url = _require_env("TARGET_DATABASE_URL")
    added, updated, n = copy_content_items(source_url, target_url)
    if n == 0:
        print("Source has no content_items; nothing to copy.", file=sys.stderr)
        sys.exit(2)
    print(f"Content library synced: {added} added, {updated} updated ({n} from source).")


if __name__ == "__main__":
    main()
