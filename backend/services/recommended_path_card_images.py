"""OpenAI Images client wrapper + library-backed ``attach_hero_urls``.

Hot path (``attach_hero_urls``) is library-only: returns pre-rendered
``(industry, section)`` blobs from ``recommended_path_process_card_library``. No live
request ever triggers OpenAI Images — that only runs in the seeder
(``backend.scripts.seed_process_card_library``).
"""

from __future__ import annotations

import base64
import logging

import httpx
from openai import OpenAI
from sqlalchemy.orm import Session

from ..config import settings
from .recommended_path_process_card_library import attach_hero_urls_from_library

logger = logging.getLogger(__name__)


def _images_generate_kwargs(model: str, prompt: str, size_raw: str) -> dict:
    """Build kwargs tolerated by dall-e-* vs GPT image suites (avoid unknown params → 400)."""
    kwargs: dict = {"model": model.strip(), "prompt": prompt, "n": 1}
    m = model.lower().strip()
    sz = size_raw.strip()
    if m == "dall-e-3" or "dall-e-3" in m:
        kwargs["size"] = sz or "1024x1024"
        kwargs["quality"] = "standard"
        return kwargs
    if "dall-e-2" in m:
        kwargs["size"] = sz or "1024x1024"
        return kwargs
    if sz:
        kwargs["size"] = sz
    return kwargs


def openai_generated_image(prompt: str) -> tuple[bytes, str]:
    """Call OpenAI Images; returns ``(bytes, mime_type)``.

    Do **not** pass ``response_format`` — newer GPT image models reject it outright; dall-e happily
    returns either ``b64_json`` or ``url`` when omitted (SDK default). We normalize both shapes.
    """
    client = OpenAI(api_key=(settings.openai_api_key or "").strip())
    model = settings.recommended_path_synthesis_image_model.strip()
    kwargs = _images_generate_kwargs(model, prompt, settings.recommended_path_synthesis_image_size)
    resp = client.images.generate(**kwargs)

    datum = resp.data[0]
    b64 = getattr(datum, "b64_json", None)
    url = getattr(datum, "url", None)
    image_b64 = getattr(datum, "image_base64", None)  # GPT image payloads (SDK-dependent)

    for alt in (b64, image_b64):
        if alt:
            raw = base64.standard_b64decode(alt)
            return raw, "image/png"

    if url:
        r_http = httpx.get(url, timeout=120.0, follow_redirects=True)
        r_http.raise_for_status()
        ctype = (r_http.headers.get("content-type") or "").split(";")[0].strip() or "image/png"
        return r_http.content, ctype

    raise ValueError("OpenAI Images response missing decodable image payload (b64/url)")


def attach_hero_urls(
    *,
    db: Session,
    cards: list[tuple[str, list[str]]],
    region: str,
    industry: str,
    role: str,
    issue: str,
    stage: str,
    skip_ai: bool,
) -> list[str | None]:
    """Return per-card hero hrefs from the seeded ``(industry, section)`` library.

    Library-only: no OpenAI calls on the request path. ``skip_ai`` is retained for the existing SSR
    fallback contract but no longer affects this code path — the lookup is cheap and deterministic.
    UI falls back to SVG bands when a row is missing. ``region/role/issue/stage`` are unused and
    kept for backwards-compatible callers.
    """
    _ = region, role, issue, stage, skip_ai
    if not cards:
        return []
    return attach_hero_urls_from_library(
        db=db,
        card_titles=[title for title, _bulls in cards],
        industry=industry,
    )
