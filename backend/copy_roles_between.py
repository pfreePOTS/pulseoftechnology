"""
Copy ``roles`` rows from one Postgres to another (upsert by ``name``).

Use when Staging (or any target) is missing personas that exist on Dev.

    SOURCE_DATABASE_URL='postgresql://...dev...' \\
    TARGET_DATABASE_URL='postgresql://...staging...' \\
    python -m backend.copy_roles_between

From the API container (URLs must be reachable from that network):

    docker compose exec -e SOURCE_DATABASE_URL=... -e TARGET_DATABASE_URL=... backend \\
      python -m backend.copy_roles_between

If you only need the **canonical** in-repo list (same as ``seed_roles``), it is simpler to run:

    DATABASE_URL='postgresql://...staging...' python -m backend.seed_roles

To copy **Content Library** rows from Dev as well, use ``backend.sync_newsletter_cms_between`` (roles + ``content_items``)
or ``backend.copy_content_items_between`` for content only.
"""

from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def _require_env(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return v


def copy_roles(source_url: str, target_url: str) -> tuple[int, int, int]:
    """
    Upsert roles from source into target (by ``name``).
    Returns (added, updated, source_row_count).
    """
    src_engine = create_engine(source_url)
    tgt_engine = create_engine(target_url)
    TgtSession = sessionmaker(autocommit=False, autoflush=False, bind=tgt_engine)

    with src_engine.connect() as conn:
        rows = conn.execute(text("SELECT name, tags FROM roles ORDER BY id")).mappings().all()

    if not rows:
        return 0, 0, 0

    from .models.role import Role

    db = TgtSession()
    added = 0
    updated = 0
    try:
        for r in rows:
            name = r["name"]
            tags = r["tags"]
            row = db.query(Role).filter(Role.name == name).first()
            if row:
                row.tags = tags
                updated += 1
            else:
                db.add(Role(name=name, tags=tags))
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
    added, updated, n = copy_roles(source_url, target_url)
    if n == 0:
        print("Source has no roles; nothing to copy.", file=sys.stderr)
        sys.exit(2)
    print(f"Roles synced: {added} added, {updated} updated ({n} from source).")


if __name__ == "__main__":
    main()
