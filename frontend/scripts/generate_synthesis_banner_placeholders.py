#!/usr/bin/env python3
"""
Raster placeholders for Recommended Path synthesis card bands until real photography lands.

Produces ``{slug}-v{N}.jpg`` at **1600×1000** (8:5) JPEGs matching README_SYNTHESIS_BANNERS.md.
Variant count MUST match frontend ``SYNTHESIS_BANNER_VARIANT_COUNT`` (`synthesisBannerVariants.ts`).

Run from repo root:

  cd frontend/scripts && pip install -r requirements-banner.txt && python generate_synthesis_banner_placeholders.py
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INDUSTRY_SYNTHESIS = ROOT / "public/images/industry-synthesis"
SYNTHESIS_FOCUS = ROOT / "public/images/synthesis-focus"

W, H = 1600, 1000
# Keep in sync with frontend/src/lib/synthesisBannerVariants.ts
VARIANT_COUNT = 6

RED = (233, 29, 36)
TEAL = (1, 158, 124)
MID = ((RED[0] + TEAL[0]) // 2, (RED[1] + TEAL[1]) // 2, (RED[2] + TEAL[2]) // 2)


INDUSTRY_SLUGS = [
    "healthcare",
    "financial-services",
    "technology",
    "manufacturing",
    "energy",
    "retail",
    "government",
    "education",
    "telecommunications",
    "transportation",
    "media-and-entertainment",
    "real-estate",
    "agriculture",
    "pharma-and-biotech",
    "legal-services",
    "hospitality",
    "nonprofit",
    "defense-and-aerospace",
    "insurance",
    "professional-services",
    "default",
]

FOCUS_SLUGS = [
    "cybersecurity",
    "ai",
    "compliance",
    "cloud",
    "it-management",
    "strategy",
    "other",
]


def slug_hue_anchor(seed: str) -> float:
    """Map seed to deterministic phase in [0,1)."""
    h = hashlib.sha256(seed.encode("utf-8")).digest()
    return int.from_bytes(h[:4], "big") / 4294967295.0


def lerp_rgb(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(ai + (bi - ai) * t) for ai, bi in zip(a, b, strict=True))


def synthesize_banner(seed: str, pivot: tuple[int, int, int]) -> Image.Image:
    """Diagonal wash at reduced resolution, then upscale for smooth gradients."""
    sw, sh = 480, 300
    img = Image.new("RGB", (sw, sh))
    px = img.load()
    anchor = slug_hue_anchor(seed)
    c_tl = lerp_rgb(RED, pivot, 0.25 + 0.35 * anchor)
    c_br = lerp_rgb(TEAL, pivot, 0.35 + 0.25 * (1 - anchor))
    for y in range(sh):
        for x in range(sw):
            tx = x / max(sw - 1, 1)
            ty = y / max(sh - 1, 1)
            diag = (tx + ty * 1.08) / 2.08
            c = lerp_rgb(c_tl, c_br, diag)
            cx, cy = (x - sw * 0.5) / sw, (y - sh * 0.45) / sh
            r = (cx * cx + cy * cy) ** 0.5
            lift = max(0.0, 0.92 - r) * 18
            c = tuple(min(255, int(v + lift)) for v in c)
            px[x, y] = c
    return img.resize((W, H), Image.Resampling.LANCZOS)


def write_jpg(path: Path, seed: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pivot = MID
    tweak = slug_hue_anchor(seed + "::pivot")
    pivot = tuple(
        int(min(255, max(0, MID[i] * (0.85 + 0.3 * ((tweak + i / 12) % 1.0))))) for i in range(3)
    )
    im = synthesize_banner(seed, pivot)
    im.save(path, format="JPEG", quality=82, optimize=True, subsampling=2)


def prune_stale_jpegs(directory: Path) -> int:
    """Drop legacy `{slug}.jpg` and `{slug}-vN.jpg` when N > VARIANT_COUNT."""
    removed = 0
    if not directory.is_dir():
        return 0
    for path in directory.glob("*.jpg"):
        stem = path.stem  # e.g. healthcare-v2  |  healthcare (legacy)
        if "-v" not in stem:
            path.unlink(missing_ok=True)
            removed += 1
            continue
        base, sep, vn = stem.rpartition("-v")
        if sep != "-v" or not vn.isdigit():
            continue
        n = int(vn)
        if n > VARIANT_COUNT or n < 1:
            path.unlink(missing_ok=True)
            removed += 1
    return removed


def verify_dimensions(path: Path) -> tuple[int, int]:
    im = Image.open(path)
    w, h = im.size
    im.close()
    return w, h


def main() -> None:
    total_removed = prune_stale_jpegs(INDUSTRY_SYNTHESIS) + prune_stale_jpegs(SYNTHESIS_FOCUS)
    if total_removed:
        print(f"Pruned {total_removed} stale JPEG(s)")

    n_written = 0
    for slug in INDUSTRY_SLUGS:
        for v in range(1, VARIANT_COUNT + 1):
            seed = f"{slug}::industry::v{v}"
            out = INDUSTRY_SYNTHESIS / f"{slug}-v{v}.jpg"
            write_jpg(out, seed)
            n_written += 1
            w, h = verify_dimensions(out)
            if (w, h) != (W, H):
                raise SystemExit(f"wrong dimensions {out}: {w}x{h}")

    for slug in FOCUS_SLUGS:
        for v in range(1, VARIANT_COUNT + 1):
            seed = f"{slug}::focus::v{v}"
            out = SYNTHESIS_FOCUS / f"{slug}-v{v}.jpg"
            write_jpg(out, seed)
            n_written += 1
            w, h = verify_dimensions(out)
            if (w, h) != (W, H):
                raise SystemExit(f"wrong dimensions {out}: {w}x{h}")

    print(f"Wrote {n_written} JPEGs ({len(INDUSTRY_SLUGS)}×{VARIANT_COUNT} industry + " f"{len(FOCUS_SLUGS)}×{VARIANT_COUNT} focus)")


if __name__ == "__main__":
    main()
