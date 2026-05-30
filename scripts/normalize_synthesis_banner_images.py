#!/usr/bin/env python3
"""Re-export synthesis card band JPEGs to a single 2:1 size for UI consistency.

Reads every *.jpg under:
  frontend/public/images/synthesis-focus/
  frontend/public/images/industry-synthesis/

Writes them back as 1600×800 RGB JPEG (center cover-crop + LANCZOS).
Run from repo root after adding or replacing source art:

  python3 scripts/normalize_synthesis_banner_images.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

TARGET_W, TARGET_H = 1600, 800


def cover_resize(im: Image.Image, tw: int, th: int) -> Image.Image:
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    root = repo / "frontend" / "public" / "images"
    n = 0
    for folder in ("synthesis-focus", "industry-synthesis"):
        d = root / folder
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*.jpg")):
            with Image.open(p) as im:
                out = cover_resize(im, TARGET_W, TARGET_H)
            out.save(p, "JPEG", quality=88, optimize=True, progressive=True)
            n += 1
            print(f"OK {p.relative_to(repo)}")
    print(f"Done. {n} files → {TARGET_W}×{TARGET_H}.")


if __name__ == "__main__":
    main()
