#!/usr/bin/env python3
"""
Normalize arbitrary photos into the Recommended Path banner spec (cover crop).

Usage:
  python normalize_synthesis_banner_images.py source1.jpg source2.jpg ./out-dir/

Writes ./out-dir/basename-1600x1000.jpg

Requires: pip install -r requirements-banner.txt
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

TARGET_W = 1600
TARGET_H = 1000
TARGET_RATIO = TARGET_W / TARGET_H


def cover_crop_resize(im: Image.Image) -> Image.Image:
    """Center-weighted crop to TARGET ratio, then downscale."""
    w, h = im.size
    if w <= 0 or h <= 0:
        raise ValueError("Invalid image dimensions")
    src_ratio = w / h
    if src_ratio > TARGET_RATIO:
        # Too wide → crop left/right
        new_w = int(round(h * TARGET_RATIO))
        x0 = (w - new_w) // 2
        cropped = im.crop((x0, 0, x0 + new_w, h))
    else:
        # Too tall → crop top/bottom
        new_h = int(round(w / TARGET_RATIO))
        y0 = (h - new_h) // 2
        cropped = im.crop((0, y0, w, y0 + new_h))

    cropped = cropped.convert("RGB")
    return cropped.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)


def main(argv: list[str]) -> None:
    if len(argv) < 3:
        print("usage: normalize_synthesis_banner_images.py <src.jpg...> <out-dir>/", file=sys.stderr)
        sys.exit(1)
    out_dir = Path(argv[-1]).resolve()
    sources = [Path(p).resolve() for p in argv[1:-1]]
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in sources:
        if not p.is_file():
            print(f"skip missing: {p}", file=sys.stderr)
            continue
        im = Image.open(p)
        im = cover_crop_resize(im)
        name = p.stem + "-1600x1000.jpg"
        dest = out_dir / name
        im.save(dest, format="JPEG", quality=88, optimize=True)
        print(dest)


if __name__ == "__main__":
    main(sys.argv)
