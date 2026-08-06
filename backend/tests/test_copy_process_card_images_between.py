"""Dev → Staging sync for the Our Process banner library (PULSE-004 regression)."""

from __future__ import annotations

import base64

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import backend.models  # noqa: F401 — register models on Base.metadata before create_all
from backend.copy_process_card_images_between import copy_process_card_images
from backend.database import Base
from backend.models.recommended_path_process_card_library import RecommendedPathProcessCardLibrary
from backend.services.recommended_path_process_card_library import PROCESS_SECTION_SLUGS

PNG_A = base64.standard_b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
PNG_B = PNG_A + b"trailing-bytes-so-the-blob-differs"


def _make_db(tmp_path, name: str):
    url = f"sqlite:///{tmp_path / name}"
    engine = create_engine(url)
    Base.metadata.create_all(bind=engine)
    return url, sessionmaker(bind=engine)


def _add_cell(
    Session,
    *,
    industry_slug: str,
    section_slug: str,
    blob: bytes = PNG_A,
    version: int = 1,
) -> None:
    db = Session()
    try:
        db.add(
            RecommendedPathProcessCardLibrary(
                industry_slug=industry_slug,
                section_slug=section_slug,
                industry_label=industry_slug.title(),
                section_label=section_slug.title(),
                image_blob=blob,
                mime_type="image/png",
                prompt="prompt",
                model="gpt-image-1",
                version=version,
            )
        )
        db.commit()
    finally:
        db.close()


def _cells(Session) -> dict[tuple[str, str], RecommendedPathProcessCardLibrary]:
    db = Session()
    try:
        return {
            (row.industry_slug, row.section_slug): row
            for row in db.query(RecommendedPathProcessCardLibrary).all()
        }
    finally:
        db.close()


@pytest.fixture
def source(tmp_path):
    return _make_db(tmp_path, "source.db")


@pytest.fixture
def target(tmp_path):
    return _make_db(tmp_path, "target.db")


def test_copies_every_cell_into_an_empty_target(source, target):
    src_url, SrcSession = source
    tgt_url, TgtSession = target
    for slug in PROCESS_SECTION_SLUGS:
        _add_cell(SrcSession, industry_slug="insurance", section_slug=slug, version=3)

    added, updated, skipped, n = copy_process_card_images(src_url, tgt_url)

    assert (added, updated, skipped, n) == (4, 0, 0, 4)
    copied = _cells(TgtSession)
    assert set(copied) == {("insurance", slug) for slug in PROCESS_SECTION_SLUGS}
    for row in copied.values():
        assert row.image_blob == PNG_A
        assert row.mime_type == "image/png"
        # Version rides along because the public href embeds it as the ``?v=`` cache key.
        assert row.version == 3
        assert row.industry_label == "Insurance"


def test_rerun_skips_cells_already_current(source, target):
    src_url, SrcSession = source
    tgt_url, _TgtSession = target
    _add_cell(SrcSession, industry_slug="insurance", section_slug="understand", version=3)

    assert copy_process_card_images(src_url, tgt_url)[:3] == (1, 0, 0)
    # Idempotent: a dropped transfer can be resumed without re-sending ~2 MB blobs.
    assert copy_process_card_images(src_url, tgt_url)[:3] == (0, 0, 1)


def test_newer_source_version_overwrites_the_target_blob(source, target):
    src_url, SrcSession = source
    tgt_url, TgtSession = target
    _add_cell(
        SrcSession, industry_slug="insurance", section_slug="understand", blob=PNG_B, version=4
    )
    _add_cell(
        TgtSession, industry_slug="insurance", section_slug="understand", blob=PNG_A, version=3
    )

    added, updated, skipped, n = copy_process_card_images(src_url, tgt_url)

    assert (added, updated, skipped, n) == (0, 1, 0, 1)
    row = _cells(TgtSession)[("insurance", "understand")]
    assert row.image_blob == PNG_B
    assert row.version == 4


def test_force_resends_cells_at_the_same_version(source, target):
    src_url, SrcSession = source
    tgt_url, TgtSession = target
    _add_cell(
        SrcSession, industry_slug="insurance", section_slug="understand", blob=PNG_B, version=3
    )
    _add_cell(
        TgtSession, industry_slug="insurance", section_slug="understand", blob=PNG_A, version=3
    )

    assert copy_process_card_images(src_url, tgt_url)[:3] == (0, 0, 1)
    assert copy_process_card_images(src_url, tgt_url, force=True)[:3] == (0, 1, 0)
    assert _cells(TgtSession)[("insurance", "understand")].image_blob == PNG_B


def test_empty_source_copies_nothing(source, target):
    src_url, _SrcSession = source
    tgt_url, TgtSession = target

    assert copy_process_card_images(src_url, tgt_url) == (0, 0, 0, 0)
    assert _cells(TgtSession) == {}
