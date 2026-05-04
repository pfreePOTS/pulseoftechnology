"""
Copy newsletter-related CMS rows from Dev (or any source DB) to Staging:

- ``roles`` (upsert by name)
- ``content_items`` (upsert by UUID, preserves ids)

    SOURCE_DATABASE_URL='postgresql://...dev...' \\
    TARGET_DATABASE_URL='postgresql://...staging...' \\
    python -m backend.sync_newsletter_cms_between

Exits with code 2 only if **both** source tables are empty. Partial empty is OK (prints a line per table).
"""

from __future__ import annotations

import os
import sys

from .copy_content_items_between import copy_content_items
from .copy_roles_between import copy_roles


def _require_env(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return v


def main() -> None:
    source_url = _require_env("SOURCE_DATABASE_URL")
    target_url = _require_env("TARGET_DATABASE_URL")

    ra, ru, rn = copy_roles(source_url, target_url)
    if rn == 0:
        print("Roles: source has no rows (skipped).", file=sys.stderr)
    else:
        print(f"Roles: {ra} added, {ru} updated ({rn} from source).")

    ca, cu, cn = copy_content_items(source_url, target_url)
    if cn == 0:
        print("Content library: source has no rows (skipped).", file=sys.stderr)
    else:
        print(f"Content library: {ca} added, {cu} updated ({cn} from source).")

    if rn == 0 and cn == 0:
        sys.exit(2)


if __name__ == "__main__":
    main()
