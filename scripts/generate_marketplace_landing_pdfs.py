#!/usr/bin/env python3
"""Build one-page PDF landing files from committed marketplace promo PNGs.

Source artwork (and GitHub ``staging``) ships PNG one-sheets only. Content Library
URLs point at ``PulseOne_XX_landing.pdf`` beside the PNGs under
``frontend/public/marketplace-offers/``.

    python3 scripts/generate_marketplace_landing_pdfs.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
OFFERS_DIR = REPO_ROOT / "frontend" / "public" / "marketplace-offers"
PROMO_GLOB = "PulseOne_*_promo_1280x720.png"


def promo_to_pdf_path(png: Path) -> Path:
    # PulseOne_05_promo_1280x720.png -> PulseOne_05_landing.pdf
    stem = png.name.replace("_promo_1280x720.png", "")
    return OFFERS_DIR / f"{stem}_landing.pdf"


def png_to_pdf(png: Path, pdf: Path) -> None:
    with Image.open(png) as im:
        rgb = im.convert("RGB") if im.mode in ("RGBA", "P", "LA") else im
        rgb.save(pdf, "PDF", resolution=150.0)


def main() -> int:
    if not OFFERS_DIR.is_dir():
        print(f"Missing directory: {OFFERS_DIR}", file=sys.stderr)
        return 1
    pngs = sorted(OFFERS_DIR.glob(PROMO_GLOB))
    if not pngs:
        print(f"No promo PNGs matching {PROMO_GLOB} in {OFFERS_DIR}", file=sys.stderr)
        return 1
    written = 0
    for png in pngs:
        pdf = promo_to_pdf_path(png)
        png_to_pdf(png, pdf)
        written += 1
        print(f"  {pdf.name}  ({png.stat().st_size // 1024} KiB src)")
    print(f"Wrote {written} landing PDF(s) to {OFFERS_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
