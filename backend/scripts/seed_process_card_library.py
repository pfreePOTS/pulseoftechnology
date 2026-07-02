"""Seed the Our Process card image library (industry × section) via OpenAI Images.

Idempotent: re-running skips cells already present unless ``--force`` is supplied. Supports
scoping to a single industry or section, parallel workers, and a dry-run mode that prints
prompts without calling OpenAI.

Run from inside Docker (one-time, ~5–10 min for the full 80-cell sweep)::

    docker compose exec backend python -m backend.scripts.seed_process_card_library
    docker compose exec backend python -m backend.scripts.seed_process_card_library \
        --industry Healthcare
    docker compose exec backend python -m backend.scripts.seed_process_card_library \
        --industry Healthcare --section understand --force

Output rows live in ``recommended_path_process_card_library`` and are served at
``GET /api/recommended-path/process-card-images/{industry_slug}/{section_slug}``.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from threading import Lock

from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models.recommended_path_process_card_library import RecommendedPathProcessCardLibrary
from ..services.ai_service import INDUSTRY_GRID_LABELS
from ..services.recommended_path_card_images import openai_generated_image
from ..services.recommended_path_process_card_library import (
    GENERIC_INDUSTRY_LABEL,
    GENERIC_INDUSTRY_SLUG,
    PROCESS_SECTION_LABELS,
    PROCESS_SECTION_SLUGS,
    build_library_prompt,
    canonical_industry_label,
    industry_slug,
    is_valid_section_slug,
    section_label_for_slug,
)

logger = logging.getLogger("seed_process_card_library")


def _industry_labels_for_run(arg: str | None) -> list[str]:
    if not arg:
        return [*INDUSTRY_GRID_LABELS, GENERIC_INDUSTRY_LABEL]
    canonical = canonical_industry_label(arg)
    if canonical is None and arg.strip().lower() == GENERIC_INDUSTRY_SLUG:
        return [GENERIC_INDUSTRY_LABEL]
    if canonical is None:
        raise SystemExit(
            f"Unknown industry {arg!r}. Choose one of: "
            f"{', '.join([*INDUSTRY_GRID_LABELS, GENERIC_INDUSTRY_LABEL])}"
        )
    return [canonical]


def _section_slugs_for_run(arg: str | None) -> list[str]:
    if not arg:
        return list(PROCESS_SECTION_SLUGS)
    slug = arg.strip().lower()
    if not is_valid_section_slug(slug):
        raise SystemExit(
            f"Unknown section {arg!r}. Choose one of: {', '.join(PROCESS_SECTION_SLUGS)}"
        )
    return [slug]


def _existing_cell(
    db: Session, *, industry_slug_value: str, section_slug_value: str
) -> RecommendedPathProcessCardLibrary | None:
    return (
        db.query(RecommendedPathProcessCardLibrary)
        .filter(
            RecommendedPathProcessCardLibrary.industry_slug == industry_slug_value,
            RecommendedPathProcessCardLibrary.section_slug == section_slug_value,
        )
        .one_or_none()
    )


def _upsert_cell(
    db: Session,
    *,
    industry_label: str,
    section_slug_value: str,
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    model: str,
) -> RecommendedPathProcessCardLibrary:
    industry_slug_value = (
        industry_slug(industry_label)
        if industry_label != GENERIC_INDUSTRY_LABEL
        else GENERIC_INDUSTRY_SLUG
    )
    section_label = section_label_for_slug(section_slug_value) or section_slug_value.title()
    now = datetime.now(UTC)
    row = _existing_cell(
        db,
        industry_slug_value=industry_slug_value,
        section_slug_value=section_slug_value,
    )
    if row is None:
        row = RecommendedPathProcessCardLibrary(
            industry_slug=industry_slug_value,
            section_slug=section_slug_value,
            industry_label=industry_label,
            section_label=section_label,
            image_blob=image_bytes,
            mime_type=mime_type,
            prompt=prompt,
            model=model,
            version=1,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.image_blob = image_bytes
        row.mime_type = mime_type
        row.prompt = prompt
        row.model = model
        row.industry_label = industry_label
        row.section_label = section_label
        row.version = (row.version or 0) + 1
        row.updated_at = now
    db.commit()
    db.refresh(row)
    return row


class _RpmLimiter:
    """Sliding 60s window. Sleeps callers so we stay at or below ``max_per_minute`` total calls."""

    def __init__(self, max_per_minute: float) -> None:
        self._max = max(0.0, float(max_per_minute))
        self._window = 60.0
        self._calls: deque[float] = deque()
        self._lock = Lock()

    def acquire(self) -> None:
        if self._max <= 0:
            return
        while True:
            with self._lock:
                now = time.monotonic()
                cutoff = now - self._window
                while self._calls and self._calls[0] <= cutoff:
                    self._calls.popleft()
                if len(self._calls) < self._max:
                    self._calls.append(now)
                    return
                sleep_for = self._window - (now - self._calls[0]) + 0.05
            time.sleep(max(0.1, sleep_for))


def _render_one(
    industry_label: str,
    section_slug_value: str,
    limiter: _RpmLimiter | None = None,
) -> tuple[bytes, str, str]:
    """Returns ``(image_bytes, mime_type, prompt)``. Raises on failure."""
    prompt = build_library_prompt(industry_label, section_slug_value)
    if limiter is not None:
        limiter.acquire()
    image_bytes, mime_type = openai_generated_image(prompt)
    return image_bytes, mime_type, prompt


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed the Our Process card image library.")
    parser.add_argument("--industry", help="Limit to one industry (canonical label).")
    parser.add_argument("--section", help="Limit to one section slug.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-render and overwrite existing cells (bumps version).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Cap how many cells to process this run (0 = no cap).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help=(
            "Parallel OpenAI calls (DB commits are sequential). Default 1 because "
            "``gpt-image-1`` enforces a strict per-minute org cap and the SDK's auto-retry "
            "burns through attempts quickly under fan-out."
        ),
    )
    parser.add_argument(
        "--rpm",
        type=float,
        default=4.0,
        help=(
            "Max OpenAI Images requests per minute. ``gpt-image-1`` defaults to 5/min "
            "for new orgs — stay safely below."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print intended cells + prompts without calling OpenAI.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose logging.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    industries = _industry_labels_for_run(args.industry)
    sections = _section_slugs_for_run(args.section)

    if not args.dry_run:
        if not (settings.openai_api_key or "").strip():
            raise SystemExit("OPENAI_API_KEY is not set; cannot generate images.")
        if not settings.recommended_path_synthesis_images_enabled:
            logger.warning(
                "recommended_path_synthesis_images_enabled is False — seeding will still run."
            )

    db = SessionLocal()
    try:
        all_cells: list[tuple[str, str]] = [(i, s) for i in industries for s in sections]
        if args.limit and args.limit > 0:
            all_cells = all_cells[: args.limit]

        skipped: list[tuple[str, str]] = []
        to_run: list[tuple[str, str]] = []
        for industry_label, section_slug_value in all_cells:
            slug_value = (
                GENERIC_INDUSTRY_SLUG
                if industry_label == GENERIC_INDUSTRY_LABEL
                else industry_slug(industry_label)
            )
            existing = _existing_cell(
                db, industry_slug_value=slug_value, section_slug_value=section_slug_value
            )
            if existing is not None and not args.force:
                skipped.append((industry_label, section_slug_value))
                continue
            to_run.append((industry_label, section_slug_value))

        logger.info(
            "Seed plan: %d cells total, %d skipped (already present), %d to render.",
            len(all_cells),
            len(skipped),
            len(to_run),
        )
        if not to_run:
            logger.info("Nothing to do.")
            return 0

        if args.dry_run:
            for industry_label, section_slug_value in to_run:
                logger.info(
                    "DRY-RUN cell industry=%s section=%s prompt=%r",
                    industry_label,
                    section_slug_value,
                    build_library_prompt(industry_label, section_slug_value),
                )
            return 0

        started = time.monotonic()
        completed = 0
        failed: list[tuple[str, str, str]] = []

        limiter = _RpmLimiter(args.rpm)
        logger.info(
            "Running with %d workers, throttled to ~%.1f OpenAI image calls per minute "
            "(stays under the gpt-image-1 default 5/min cap).",
            max(1, args.workers),
            args.rpm,
        )
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            future_to_cell = {
                pool.submit(_render_one, industry_label, section_slug_value, limiter): (
                    industry_label,
                    section_slug_value,
                )
                for industry_label, section_slug_value in to_run
            }
            for future in as_completed(future_to_cell):
                industry_label, section_slug_value = future_to_cell[future]
                try:
                    image_bytes, mime_type, prompt = future.result()
                except Exception as exc:
                    failed.append((industry_label, section_slug_value, str(exc)))
                    logger.exception(
                        "Failed cell industry=%s section=%s",
                        industry_label,
                        section_slug_value,
                    )
                    continue
                row = _upsert_cell(
                    db,
                    industry_label=industry_label,
                    section_slug_value=section_slug_value,
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    prompt=prompt,
                    model=settings.recommended_path_synthesis_image_model.strip(),
                )
                completed += 1
                elapsed = time.monotonic() - started
                logger.info(
                    "Wrote cell %d/%d industry=%s section=%s id=%s (%.1fs total elapsed)",
                    completed,
                    len(to_run),
                    industry_label,
                    section_slug_value,
                    row.id,
                    elapsed,
                )

        if failed:
            logger.warning(
                "Seed finished with %d failures (out of %d). Failed cells: %s",
                len(failed),
                len(to_run),
                ", ".join(f"{i}/{s}" for i, s, _ in failed),
            )
            return 1
        logger.info("Seed finished successfully. %d cells rendered.", completed)
        return 0
    finally:
        db.close()

    _ = PROCESS_SECTION_LABELS


if __name__ == "__main__":
    sys.exit(main())
