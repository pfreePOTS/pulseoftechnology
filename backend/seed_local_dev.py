"""
One-shot curated bootstrap for an empty Postgres (local or shared dev).

Runs, in order:
  1. seed_sources — RSS catalogue (ingestion needs rows in ``sources``)
  2. seed_topics — core radar topics with ``is_published=True`` so /radar has stars
  3. seed_roles — standard executive personas for newsletters
  4. seed_marketplace_offers — PulseOne Marketplace Content Library promos

Does **not** insert articles — use ingestion after sources exist, or restore a dump:

    ./scripts/db/export_data.sh   # machine that already has rows
    ./scripts/db/import_data.sh path/to.dump

Compose:

    docker compose exec backend python -m backend.seed_local_dev
"""

from __future__ import annotations


def seed() -> None:
    from . import seed_marketplace_offers as seed_marketplace_offers_mod
    from . import seed_roles as seed_roles_mod
    from . import seed_sources as seed_sources_mod
    from . import seed_topics as seed_topics_mod

    print("=== backend.seed_sources ===")
    seed_sources_mod.seed()
    print("\n=== backend.seed_topics ===")
    seed_topics_mod.seed()
    print("\n=== backend.seed_roles ===")
    seed_roles_mod.seed()
    print("\n=== backend.seed_marketplace_offers ===")
    seed_marketplace_offers_mod.seed()
    print("\nDone. Run RSS ingestion / AI pipeline for articles (or pg_restore dump).")


if __name__ == "__main__":
    seed()
