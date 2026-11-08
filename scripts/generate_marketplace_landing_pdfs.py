#!/usr/bin/env python3
"""Build one-page PDF landing files from committed marketplace promo PNGs.

Prefer real slicks under Marketing Assets when available. This script is a
fallback that writes kebab-case PDFs to ``frontend/public/service-offers/``.

    python3 scripts/generate_marketplace_landing_pdfs.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.marketplace_offers import (  # noqa: E402
    MARKETPLACE_OFFERS,
    offer_landing_pdf_path,
    offer_pdf_filename,
)

PROMO_DIR = REPO_ROOT / "frontend" / "public" / "marketplace-offers"
PDF_DIR = REPO_ROOT / "frontend" / "public" / "service-offers"


def png_to_pdf(png: Path, pdf: Path) -> None:
    with Image.open(png) as im:
        rgb = im.convert("RGB") if im.mode in ("RGBA", "P", "LA") else im
        rgb.save(pdf, "PDF", resolution=150.0)


def main() -> int:
    if not PROMO_DIR.is_dir():
        print(f"Missing directory: {PROMO_DIR}", file=sys.stderr)
        return 1
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for offer in MARKETPLACE_OFFERS:
        aid = str(offer["asset_id"]).zfill(2)
        title = str(offer["title"])
        png = PROMO_DIR / f"PulseOne_{aid}_promo_1280x720.png"
        if not png.is_file():
            print(f"skip missing promo PNG: {png.name}", file=sys.stderr)
            continue
        pdf = PDF_DIR / offer_pdf_filename(title)
        png_to_pdf(png, pdf)
        written += 1
        print(f"  {offer_landing_pdf_path(aid)}  ({png.stat().st_size // 1024} KiB src)")
    print(f"Wrote {written} landing PDF(s) to {PDF_DIR}")
    return 0 if written else 1


if __name__ == "__main__":
    raise SystemExit(main())
