"""Lookup + prompt helpers for the pre-rendered Our Process card image library (industry × section).

Replaces per-intake OpenAI image generation on ``/api/recommended-path``: rows are seeded once
via ``backend/scripts/seed_process_card_library.py``. The four cards
(Understand / Recommend / Implement / Manage) map 1:1 to fixed section slugs.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from typing import Final

from sqlalchemy.orm import Session

from ..models.recommended_path_process_card_library import RecommendedPathProcessCardLibrary
from ..services.ai_service import _INDUSTRY_NAME_ALIASES, INDUSTRY_GRID_LABELS

logger = logging.getLogger(__name__)

# ── Canonical four sections ──────────────────────────────────────────────────
# Order is significant: card_index 0..3 maps to these in order. Must stay in sync
# with the LLM contract in ``_PROCESS_CARD_TITLES`` in ``ai_service.py``.
PROCESS_SECTION_SLUGS: Final[tuple[str, ...]] = ("understand", "recommend", "implement", "manage")
PROCESS_SECTION_LABELS: Final[tuple[str, ...]] = ("Understand", "Recommend", "Implement", "Manage")

_SECTION_LABEL_BY_SLUG: Final[dict[str, str]] = dict(zip(PROCESS_SECTION_SLUGS, PROCESS_SECTION_LABELS, strict=True))
_SECTION_SLUG_BY_LABEL: Final[dict[str, str]] = {
    label.lower(): slug for slug, label in zip(PROCESS_SECTION_SLUGS, PROCESS_SECTION_LABELS, strict=True)
}

GENERIC_INDUSTRY_SLUG: Final[str] = "generic"
GENERIC_INDUSTRY_LABEL: Final[str] = "Generic"

_SLUG_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def industry_slug(name: str | None) -> str:
    """Normalize industry to a canonical lowercase hyphen slug; unknown names → ``generic``."""
    canonical = canonical_industry_label(name)
    if canonical is None:
        return GENERIC_INDUSTRY_SLUG
    raw = canonical.lower().replace("&", " ").replace("/", " ")
    slug = _SLUG_NON_ALNUM.sub("-", raw).strip("-")
    return slug or GENERIC_INDUSTRY_SLUG


def canonical_industry_label(name: str | None) -> str | None:
    """Map free-form industry text to the canonical grid label (None if unknown)."""
    if name is None:
        return None
    key = name.strip()
    if not key:
        return None
    if key in INDUSTRY_GRID_LABELS:
        return key
    if key in _INDUSTRY_NAME_ALIASES:
        return _INDUSTRY_NAME_ALIASES[key]
    low = key.lower()
    for label in INDUSTRY_GRID_LABELS:
        if label.lower() == low:
            return label
    for alias, canonical in _INDUSTRY_NAME_ALIASES.items():
        if alias.lower() == low:
            return canonical
    return None


def section_slug_for_card_index(card_index: int) -> str | None:
    if 0 <= card_index < len(PROCESS_SECTION_SLUGS):
        return PROCESS_SECTION_SLUGS[card_index]
    return None


def section_slug_for_title(title: str | None) -> str | None:
    if title is None:
        return None
    return _SECTION_SLUG_BY_LABEL.get(title.strip().lower())


def section_label_for_slug(slug: str) -> str | None:
    return _SECTION_LABEL_BY_SLUG.get(slug)


def is_valid_section_slug(slug: str) -> bool:
    return slug in _SECTION_LABEL_BY_SLUG


def process_card_library_href(industry_slug_value: str, section_slug_value: str, version: int | None = None) -> str:
    """Path-only URL; browser merges with ``apiOriginForBrowser()`` (handles ``/__pulse_api`` proxy)."""
    path = f"/api/recommended-path/process-card-images/{industry_slug_value}/{section_slug_value}"
    if version is None:
        return path
    return f"{path}?v={max(1, int(version))}"


def lookup_library_row(
    db: Session,
    *,
    industry_slug_value: str,
    section_slug_value: str,
) -> RecommendedPathProcessCardLibrary | None:
    return (
        db.query(RecommendedPathProcessCardLibrary)
        .filter(
            RecommendedPathProcessCardLibrary.industry_slug == industry_slug_value,
            RecommendedPathProcessCardLibrary.section_slug == section_slug_value,
        )
        .one_or_none()
    )


# ── Prompt builders ──────────────────────────────────────────────────────────
# Photorealistic, people-free industry detail crops. Composition is tuned for a wide
# banner crop (3:2 source rendered into a ~200x170 card with a soft white scrim over
# the lower third), so the strongest visual detail sits in the upper two-thirds.

_STYLE_ANCHOR: Final[str] = (
    "Photorealistic professional editorial background photography, no people, no humans, no bodies, "
    "no faces, no hands, no portraits, no silhouettes, no reflections of people. "
    "Strictly no readable text, no captions, no logos, no brand marks, no watermarks, no UI screenshots, "
    "no fake app screens, no generated words, no typography. "
    "Color: balanced daylight white balance around 5500K, neutral cool-to-neutral tone, not warm, not yellow, "
    "not orange, not sepia. Crisp realistic materials, clean modern enterprise environment. "
    "Composition: wide horizontal 3:2 frame, card-banner crop safe, strongest industry detail in the upper "
    "two-thirds, lower third simple and uncluttered so a soft white fade can sit there cleanly. "
    "Camera: full-frame DSLR, 35mm or 50mm lens, f/5.6, sharp environmental detail, mild depth of field. "
    "Do not render people, faces, hands, limbs, mannequins, statues, dolls, humanoid robots, or anatomy of any kind. "
    "Do not render cartoons, illustration, 3D CGI, sketch, painting, vintage film grain, or stock-photo people."
)

_SECTION_BRIEFS: Final[dict[str, str]] = {
    "understand": (
        "Environmental establishing detail crop that communicates discovery and context: glass partitions, "
        "work surfaces, instruments, boards, shelves, route maps, or operational fixtures from the industry. "
        "No meeting scene and no people."
    ),
    "recommend": (
        "Decision and comparison still-life: blank comparison documents, blank planning sheets, unlabeled laptop "
        "or tablet edge, clean conference table, abstract charts with no readable text. Tie the objects to the "
        "industry setting visible in the background."
    ),
    "implement": (
        "Hands-on implementation detail without hands: equipment, cabling, server rack, workstation peripherals, "
        "machinery controls, installation-ready modules, clean tools, or technical components specific to the "
        "industry."
    ),
    "manage": (
        "Operations monitoring detail: wide monitors or control panels showing abstract non-readable dashboards, "
        "status lights, equipment racks, control room surfaces, dispatch boards, or monitoring stations. No UI "
        "screenshots and no readable text."
    ),
}

_INDUSTRY_SCENES: Final[dict[str, str]] = {
    "Healthcare": (
        "modern hospital operations environment: clean clinical corridor glass, nurse-station surfaces, medical "
        "devices, wall-mounted monitors with unreadable abstract charts, neutral blue-white daylight"
    ),
    "Financial Services": (
        "financial services operations floor: secure trading-office glass, blank compliance binders, abstract risk "
        "dashboards, clean desk surfaces, city light through windows"
    ),
    "Technology": (
        "technology company infrastructure space: server racks, network cables, clean workbench, abstract system "
        "dashboards, modern office glass and cool daylight"
    ),
    "Manufacturing": (
        "modern factory operations environment: robotic cells, conveyor segments, machine-control panels, safety "
        "floor markings, industrial glass, cool overhead daylight"
    ),
    "Energy": (
        "utility control environment: grid operations monitors with unreadable abstract maps, substation diagrams "
        "without text, clean control-room surfaces, wind or solar operations cues"
    ),
    "Retail": (
        "retail operations environment: store fixture details, inventory shelves, point-of-sale hardware without "
        "logos, merchandising boards with no readable text, clean back-office surfaces"
    ),
    "Government": (
        "government administrative operations environment: civic building glass, records shelves, public-service "
        "counter details, secure workstation surfaces, neutral institutional daylight"
    ),
    "Education": (
        "education campus technology environment: classroom corridor glass, lecture-room equipment, campus IT "
        "workbench, blank scheduling boards, cool daylight"
    ),
    "Telecommunications": (
        "telecom network operations environment: fiber patch panels, cable trays, racks, abstract topology screens "
        "with no readable labels, cool blue-white lighting"
    ),
    "Transportation": (
        "transportation logistics operations environment: dispatch monitors with abstract route shapes, fleet "
        "tracking boards without readable text, depot equipment, clean control-room surfaces"
    ),
    "Media & Entertainment": (
        "media operations environment: post-production suite details, editing consoles, sound panels, content-grid "
        "monitors with blurred abstract thumbnails and no readable text"
    ),
    "Real Estate": (
        "commercial real estate operations environment: building control panels, floor-plan sheets with no readable "
        "text, smart-building sensors, glass office with city architecture"
    ),
    "Agriculture": (
        "modern agribusiness technology environment: soil sensors, irrigation-control equipment, aerial field "
        "imagery blurred on screens, equipment-health dashboards with no readable text"
    ),
    "Pharma & Biotech": (
        "pharma and biotech environment: clean laboratory glass, lab benches, chromatography equipment, stainless "
        "bioprocessing tanks, tubing, valves, sterile production corridor, cool blue-white daylight"
    ),
    "Legal Services": (
        "law firm operations environment: law library shelves, blank legal binders, polished conference table, "
        "secure document-review workstation, glass office walls"
    ),
    "Hospitality": (
        "hospitality operations environment: hotel back-office desk, property-management monitors with abstract "
        "unreadable panels, key-card hardware, lobby glass softly visible"
    ),
    "Nonprofit": (
        "nonprofit operations environment: modest program office, blank community planning boards, donor database "
        "dashboard shapes with no readable text, clean shared workspace"
    ),
    "Defense & Aerospace": (
        "defense and aerospace contractor environment: secure glass room, aerospace component models, satellite or "
        "aircraft schematics on monitors with no readable text, no weapons, no insignia"
    ),
    "Insurance": (
        "insurance carrier operations environment: claims workstations, blank forms, abstract underwriting dashboards, "
        "secure records shelves, neutral office glass"
    ),
    "Professional Services": (
        "professional services operations environment: clean strategy room, blank planning documents, laptop edges, "
        "abstract charts with no readable text, city view through office glass"
    ),
    GENERIC_INDUSTRY_LABEL: (
        "modern enterprise operations environment: clean workbench, abstract monitoring screens, blank planning "
        "documents, glass partitions, cool neutral daylight"
    ),
}


def build_library_prompt(industry_label: str, section_slug_value: str) -> str:
    """Compose the OpenAI Images prompt for a single ``(industry, section)`` cell."""
    section_brief = _SECTION_BRIEFS.get(section_slug_value)
    if not section_brief:
        raise ValueError(f"Unknown section slug: {section_slug_value!r}")
    scene = _INDUSTRY_SCENES.get(industry_label) or _INDUSTRY_SCENES[GENERIC_INDUSTRY_LABEL]
    return (
        f"Setting: {scene}. "
        f"Action: {section_brief} "
        f"{_STYLE_ANCHOR}"
    )[:3950]


def attach_hero_urls_from_library(
    *,
    db: Session,
    card_titles: Sequence[str],
    industry: str,
) -> list[str | None]:
    """Return per-card hero hrefs from the library; None when no seeded row exists for that cell.

    The frontend falls back to ``SynthesisCardBandImages`` (SVG bands) when a cell is None,
    which keeps the page functional before/after partial seeding.
    """
    industry_slug_value = industry_slug(industry)
    out: list[str | None] = []
    for idx, title in enumerate(card_titles):
        slug = section_slug_for_title(title) or section_slug_for_card_index(idx)
        if slug is None:
            out.append(None)
            continue
        row = lookup_library_row(
            db,
            industry_slug_value=industry_slug_value,
            section_slug_value=slug,
        )
        if row is not None:
            out.append(process_card_library_href(industry_slug_value, slug, row.version))
            continue
        if industry_slug_value != GENERIC_INDUSTRY_SLUG:
            fallback = lookup_library_row(
                db,
                industry_slug_value=GENERIC_INDUSTRY_SLUG,
                section_slug_value=slug,
            )
            if fallback is not None:
                out.append(process_card_library_href(GENERIC_INDUSTRY_SLUG, slug, fallback.version))
                continue
        out.append(None)
    return out
