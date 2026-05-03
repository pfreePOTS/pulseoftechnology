#!/usr/bin/env python3
"""
Generate PulseOne-toned placeholders under frontend/public/

Requires: pillow, numpy

    pip install pillow numpy
    python scripts/generate_frontend_placeholders.py

Raster assets are abstract brand-toned meshes (not stock photography).
Partner carousel files are neutral monogram placeholders — swap for real logos.
Raster SVG logos: pulseone_logo_official.svg, pulseone_logo_dark.svg

If Pillow lacks WEBP encoder, writes .png beside the requested .webp (update imports if that happens).

"""

from __future__ import annotations

import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"
IMAGES = PUBLIC / "images"
REC = PUBLIC / "recommended-path"


def branded_mesh(width: int, height: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    xx = np.linspace(0.0, 1.0, width, dtype=np.float32)
    yy = np.linspace(0.0, 1.0, height, dtype=np.float32)
    xv, yv = np.meshgrid(xx, yy)

    base = np.stack(
        [
            np.full_like(xv, 14.0, dtype=np.float32),
            np.full_like(xv, 17.0, dtype=np.float32),
            np.full_like(xv, 24.0, dtype=np.float32),
        ],
        axis=-1,
    )

    cx, cy = 0.52, 0.42
    d = np.sqrt((xv - cx) ** 2 + (yv - cy) ** 2)
    base += np.exp(-d / 0.45)[..., np.newaxis] * np.array([20.0, 14.0, 11.0], dtype=np.float32)

    def blob(mx: float, my: float, spread: float, color: tuple[float, float, float]) -> np.ndarray:
        dist = np.sqrt((xv - mx) ** 2 + (yv - my) ** 2)
        g = np.exp(-((dist**2) / (spread**2)))[..., np.newaxis]
        return g * np.array(color, dtype=np.float32)

    base += blob(0.22 + 0.04 * rng.standard_normal(), 0.28 + 0.03 * rng.standard_normal(), 0.38, (8.0, 118.0, 94.0))
    base += blob(0.78, 0.65, 0.32, (5.0, 85.0, 70.0))
    base += blob(0.82 + 0.03 * rng.standard_normal(), 0.22 + 0.03 * rng.standard_normal(), 0.22, (168.0, 24.0, 28.0))
    base += blob(0.12, 0.78, 0.35, (72.0, 19.0, 22.0))

    grain = rng.normal(scale=4.8, size=base.shape).astype(np.float32)
    for c in range(3):
        grain[..., c] -= grain[..., c].mean()
    base += grain * 0.35

    return np.clip(base, 0.0, 255.0).astype(np.uint8)


def save_png_rgb(arr_or_im: np.ndarray | Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray(arr_or_im, mode="RGB") if isinstance(arr_or_im, np.ndarray) else arr_or_im.convert("RGB")
    im.save(path, optimize=True, compress_level=6)


def save_jpg_rgb(im: Image.Image | np.ndarray, path: Path, quality: int = 88) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pic = Image.fromarray(im, mode="RGB") if isinstance(im, np.ndarray) else im.convert("RGB")
    pic.save(path, quality=quality, optimize=True, progressive=True)


def light_card(rgb: np.ndarray, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    lift = rng.uniform(6.0, 16.0, size=(1, 1, 3)).astype(np.float32)
    lift[..., 2] *= 0.65
    return np.clip(rgb.astype(np.float32) + lift * np.ones_like(rgb) * 0.085, 0.0, 255.0).astype(np.uint8)


def slug_monogram(filename: str) -> str:
    stem = Path(filename).stem.removeprefix("logo_")
    alnum = "".join(ch for ch in stem.upper() if ch.isalnum())
    if not alnum:
        return "?"
    return alnum[:4]


def sans_bold(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    for fp in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(fp, size)
        except OSError:
            continue
    return ImageFont.load_default()


def partner_slide(path_under_images: Path, seed: int) -> Image.Image:
    base = Image.fromarray(light_card(branded_mesh(560, 300, seed), seed ^ 91331), mode="RGB")
    rgba = Image.new("RGBA", base.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(rgba)
    w, h = base.size
    dr.rounded_rectangle((10, 10, w - 11, h - 11), radius=16, outline=(200, 210, 218), width=2)
    label = slug_monogram(path_under_images.name)
    font = sans_bold(26)
    bbox = dr.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    dr.text(((w - tw) / 2, (h - th) / 2 - 4), label, fill=(92, 102, 112, 238), font=font)
    return Image.alpha_composite(base.convert("RGBA"), rgba).convert("RGB")


def save_partner(path_under_images: Path, seed: int) -> None:
    im = partner_slide(path_under_images, seed)
    suf = path_under_images.suffix.lower()
    out = IMAGES / path_under_images.name
    if suf in (".jpg", ".jpeg"):
        save_jpg_rgb(im, out)
        return
    if suf == ".webp":
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            im.save(out, format="WEBP", quality=82, method=6)
        except ValueError:
            alt = out.with_suffix(".png")
            save_png_rgb(im, alt)
            print(f"WARN: WEBP unsupported; wrote {alt.relative_to(ROOT)} — update imports if needed.")
        return
    save_png_rgb(im, out)


def svg_wordmarks() -> tuple[str, str]:
    light = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="tid" viewBox="0 0 440 118">
<title id="tid">PulseOne</title>
<text x="12" y="58" font-family="IBM Plex Sans, IBM Plex Sans Text, ui-sans-serif, sans-serif"
      font-size="52" font-weight="700" letter-spacing="0.11em"><tspan fill="#111827">PULSE</tspan><tspan fill="#d5171e">ONE</tspan></text>
<text x="12" y="98" font-family="IBM Plex Sans, IBM Plex Sans Text, ui-sans-serif, sans-serif"
      font-size="10.25" font-weight="500" letter-spacing="0.26em" fill="#605F5F">PEOPLE | TECHNOLOGY | PROGRESS</text>
</svg>
"""
    dark = light.replace('#111827">PULSE', '#FFFFFF">PULSE').replace('#605F5F', '#A8B4BC')
    return light, dark


PARTNER_FILENAMES = """\
logo_microsoft.png
logo_barracuda.jpg
logo_avepoint.png
logo_msp360.png
logo_bluepisces.png
logo_seedpod.jpg
logo_fortinet.png
logo_dell.png
logo_sonicwall.jpg
logo_knitsecurity.png
logo_itglue.png
logo_rethink.png
logo_traderocket.jpg
logo_healthcareblocks.png
logo_touchbrick.png
logo_aphthoria.webp
logo_inboundav.png
logo_sparxworks.png
logo_heartland.jpg
logo_westerncomputer.jpg\
""".splitlines()


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    REC.mkdir(parents=True, exist_ok=True)

    save_png_rgb(branded_mesh(1920, 1080, 70421), PUBLIC / "FrontPage_SecurityImage.png")
    save_png_rgb(branded_mesh(1920, 1080, 88104), PUBLIC / "hero-bg.png")
    save_png_rgb(branded_mesh(1920, 1040, 59102), IMAGES / "hero_assessments.png")

    save_jpg_rgb(light_card(branded_mesh(1400, 900, 33101), 33101 ^ 444), IMAGES / "card_team_table.jpg")
    save_jpg_rgb(light_card(branded_mesh(1400, 900, 44202), 44202 ^ 444), IMAGES / "card_three_sections.jpg")
    save_jpg_rgb(light_card(branded_mesh(1400, 940, 55303), 55303 ^ 444), IMAGES / "assess_team.jpg")
    save_jpg_rgb(light_card(branded_mesh(1400, 900, 66404), 66404 ^ 444), IMAGES / "consultation_meeting.jpg")

    save_png_rgb(light_card(branded_mesh(1400, 840, 77505), 77505 ^ 555), IMAGES / "team_highfive.png")
    save_jpg_rgb(light_card(branded_mesh(1400, 840, 88606), 88606 ^ 555), IMAGES / "team_consulting.jpg")
    save_jpg_rgb(light_card(branded_mesh(1600, 640, 99707), 99707 ^ 555), IMAGES / "engage_cta.jpg")

    save_jpg_rgb(light_card(branded_mesh(1280, 720, 60001), 60001 ^ 777), IMAGES / "people_team.jpg")
    save_jpg_rgb(light_card(branded_mesh(1280, 720, 60002), 60002 ^ 777), IMAGES / "technology_server.jpg")
    save_jpg_rgb(light_card(branded_mesh(1280, 720, 60003), 60003 ^ 777), IMAGES / "progress_handshake.jpg")

    save_png_rgb(branded_mesh(1600, 900, 71001), REC / "hero-recommended-transport.png")
    save_png_rgb(branded_mesh(1600, 900, 71002), REC / "hero-recommended-ai.png")
    save_png_rgb(branded_mesh(1600, 900, 71003), REC / "hero-recommended-enterprise.png")

    for i, fname in enumerate(PARTNER_FILENAMES):
        save_partner(Path(fname), zlib.adler32(fname.encode()) + i)

    light_svg, dark_svg = svg_wordmarks()
    (PUBLIC / "pulseone_logo_official.svg").write_text(light_svg, encoding="utf-8")
    (PUBLIC / "pulseone_logo_dark.svg").write_text(dark_svg, encoding="utf-8")


if __name__ == "__main__":
    main()
