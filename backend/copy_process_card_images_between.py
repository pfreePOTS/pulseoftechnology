"""
Copy ``recommended_path_process_card_library`` rows from one Postgres to another
(upsert by ``(industry_slug, section_slug)``).

Use when a target environment has the table but no seeded banners, so ``/recommended-path``
Our Process cards fall back to SVG bands. Re-seeding on the target is not always possible —
the seeder needs ``OPENAI_API_KEY`` and burns image-generation quota — so copy the blobs
that Dev already rendered.

    SOURCE_DATABASE_URL='postgresql://...dev...' \\
    TARGET_DATABASE_URL='postgresql://...staging...' \\
    python -m backend.copy_process_card_images_between

Blobs are ~2 MB each (~170 MB for the full 21 x 4 sweep), so rows are streamed one at a
time and cells already present at the same ``version`` are skipped. That makes the command
safe to re-run after a dropped connection. Set ``FORCE=1`` to re-send every cell.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from .models.recommended_path_process_card_library import RecommendedPathProcessCardLibrary

_CELL_COLUMNS = (
    "industry_slug, section_slug, industry_label, section_label, "
    "image_blob, mime_type, prompt, model, version, created_at, updated_at"
)


def _require_env(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return v


def _env_flag(name: str) -> bool:
    return (os.environ.get(name) or "").strip().lower() in {"1", "true", "yes", "on"}


def _as_datetime(value: object) -> datetime:
    """Raw-SQL timestamps come back as ``datetime`` on psycopg but as ``str`` on sqlite."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    return datetime.now(UTC)


def _source_cells(conn) -> list[tuple[str, str, int]]:
    """Keys + versions only — never load every blob into memory at once."""
    rows = (
        conn.execute(
            text(
                """
                SELECT industry_slug, section_slug, version
                FROM recommended_path_process_card_library
                ORDER BY industry_slug, section_slug
                """
            )
        )
        .mappings()
        .all()
    )
    return [(r["industry_slug"], r["section_slug"], int(r["version"] or 1)) for r in rows]


def _stream_source_rows(conn, cells: list[tuple[str, str, int]]) -> Iterator[dict]:
    for industry_slug_value, section_slug_value, _version in cells:
        row = (
            conn.execute(
                text(
                    f"""
                    SELECT {_CELL_COLUMNS}
                    FROM recommended_path_process_card_library
                    WHERE industry_slug = :industry AND section_slug = :section
                    """
                ),
                {"industry": industry_slug_value, "section": section_slug_value},
            )
            .mappings()
            .one_or_none()
        )
        if row is not None:
            yield dict(row)


def copy_process_card_images(
    source_url: str,
    target_url: str,
    *,
    force: bool = False,
) -> tuple[int, int, int, int]:
    """Upsert process card banners from source into target.

    Returns ``(added, updated, skipped, source_row_count)``. A cell is skipped when the target
    already holds the same ``(industry_slug, section_slug)`` at the same ``version`` and
    ``force`` is False, which keeps re-runs cheap over a slow link.
    """
    src_engine = create_engine(source_url)
    tgt_engine = create_engine(target_url)
    TgtSession = sessionmaker(autocommit=False, autoflush=False, bind=tgt_engine)

    with src_engine.connect() as conn:
        cells = _source_cells(conn)
        if not cells:
            return 0, 0, 0, 0

        db = TgtSession()
        added = 0
        updated = 0
        skipped = 0
        try:
            existing = {
                (row.industry_slug, row.section_slug): row
                for row in db.query(RecommendedPathProcessCardLibrary).all()
            }
            pending = [
                cell
                for cell in cells
                if force
                or (existing.get((cell[0], cell[1])) is None)
                or (existing[(cell[0], cell[1])].version or 1) != cell[2]
            ]
            skipped = len(cells) - len(pending)

            for src in _stream_source_rows(conn, pending):
                key = (src["industry_slug"], src["section_slug"])
                row = existing.get(key)
                if row is None:
                    row = RecommendedPathProcessCardLibrary(
                        industry_slug=src["industry_slug"],
                        section_slug=src["section_slug"],
                    )
                    db.add(row)
                    added += 1
                else:
                    updated += 1
                row.industry_label = src["industry_label"]
                row.section_label = src["section_label"]
                row.image_blob = src["image_blob"]
                row.mime_type = src["mime_type"]
                row.prompt = src["prompt"]
                row.model = src["model"]
                row.version = src["version"]
                row.created_at = _as_datetime(src["created_at"])
                row.updated_at = _as_datetime(src["updated_at"])
                # Commit per cell so an interrupted run keeps the cells it already sent.
                db.commit()
                existing[key] = row
                print(
                    f"  {key[0]}/{key[1]} v{src['version']} ({len(src['image_blob'])} bytes)",
                    flush=True,
                )
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    return added, updated, skipped, len(cells)


def main() -> None:
    source_url = _require_env("SOURCE_DATABASE_URL")
    target_url = _require_env("TARGET_DATABASE_URL")
    added, updated, skipped, n = copy_process_card_images(
        source_url, target_url, force=_env_flag("FORCE")
    )
    if n == 0:
        print(
            "Source has no process card images; run "
            "backend.scripts.seed_process_card_library there first.",
            file=sys.stderr,
        )
        sys.exit(2)
    print(
        f"Process card images synced: {added} added, {updated} updated, "
        f"{skipped} already current ({n} from source)."
    )


if __name__ == "__main__":
    main()
