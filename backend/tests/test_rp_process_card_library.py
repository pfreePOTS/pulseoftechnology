"""Process card library: slug normalization, lookup, endpoint, and ``attach_hero_urls`` integration."""

from __future__ import annotations

import base64

from backend.models.recommended_path_process_card_library import RecommendedPathProcessCardLibrary
from backend.services import recommended_path_card_images as rpci
from backend.services.recommended_path_process_card_library import (
    GENERIC_INDUSTRY_LABEL,
    GENERIC_INDUSTRY_SLUG,
    PROCESS_SECTION_SLUGS,
    attach_hero_urls_from_library,
    build_library_prompt,
    canonical_industry_label,
    industry_slug,
    process_card_library_href,
    section_slug_for_card_index,
    section_slug_for_title,
)

ONE_PX_PNG = base64.standard_b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _seed(db_session, *, industry_slug_value: str, section: str, industry_label: str = "X") -> None:
    db_session.add(
        RecommendedPathProcessCardLibrary(
            industry_slug=industry_slug_value,
            section_slug=section,
            industry_label=industry_label,
            section_label=section.title(),
            image_blob=ONE_PX_PNG,
            mime_type="image/png",
            prompt="test",
            model="test",
            version=1,
        )
    )
    db_session.commit()


def test_image_model_default_uses_supported_gpt_image_suite():
    assert rpci.settings.recommended_path_synthesis_image_model == "gpt-image-1"
    assert rpci.settings.recommended_path_synthesis_image_size == "1536x1024"


def test_attach_hero_urls_never_calls_openai_on_request_path(db_session, monkeypatch):
    """Hot path is library-only — OpenAI must never be invoked from ``attach_hero_urls``."""
    calls = {"n": 0}

    def fake(_prompt: str) -> tuple[bytes, str]:
        calls["n"] += 1
        return (ONE_PX_PNG, "image/png")

    monkeypatch.setattr(rpci, "openai_generated_image", fake)
    cards = [
        ("Understand", ["a", "b"]),
        ("Recommend", ["a", "b"]),
        ("Implement", ["a", "b"]),
        ("Manage", ["a", "b"]),
    ]
    urls = rpci.attach_hero_urls(
        db=db_session,
        cards=cards,
        region="",
        industry="Healthcare",
        role="CIO",
        issue="Cybersecurity",
        stage="Consolidating tools",
        skip_ai=False,
    )
    assert calls["n"] == 0
    assert urls == [None, None, None, None]


def test_industry_slug_canonicalizes_aliases_and_unknowns():
    assert industry_slug("Healthcare") == "healthcare"
    assert industry_slug("Financial Services") == "financial-services"
    assert industry_slug("Pharma & Biotech") == "pharma-biotech"
    assert industry_slug("Media & Entertainment") == "media-entertainment"
    assert industry_slug("Finance & Banking") == "financial-services"
    assert industry_slug("totally unknown sector") == GENERIC_INDUSTRY_SLUG
    assert industry_slug("") == GENERIC_INDUSTRY_SLUG
    assert industry_slug(None) == GENERIC_INDUSTRY_SLUG


def test_section_slug_lookup_from_title_or_index():
    assert section_slug_for_card_index(0) == "understand"
    assert section_slug_for_card_index(3) == "manage"
    assert section_slug_for_card_index(7) is None
    assert section_slug_for_title("Understand") == "understand"
    assert section_slug_for_title(" recommend ") == "recommend"
    assert section_slug_for_title("unknown") is None


def test_canonical_industry_label_handles_case_and_alias():
    assert canonical_industry_label("healthcare") == "Healthcare"
    assert canonical_industry_label("Finance & Banking") == "Financial Services"
    assert canonical_industry_label("nope") is None


def test_build_library_prompt_contains_industry_and_section_cues():
    prompt = build_library_prompt("Healthcare", "understand")
    assert "hospital" in prompt.lower()
    assert "photorealistic" in prompt.lower()


def test_build_library_prompt_keeps_recommend_and_manage_people_free():
    recommend = build_library_prompt("Legal Services", "recommend").lower()
    manage = build_library_prompt("Legal Services", "manage").lower()
    assert "law" in recommend
    assert "comparison" in recommend
    assert "monitoring" in manage
    assert recommend != manage
    for prompt in (recommend, manage):
        assert "no people" in prompt
        assert "no readable text" in prompt


def test_build_library_prompt_puts_people_in_understand_and_implement():
    understand = build_library_prompt("Pharma & Biotech", "understand")
    implement = build_library_prompt("Pharma & Biotech", "implement")
    assert "Two professionals" in understand
    assert "One specialist" in implement
    for prompt in (understand, implement):
        assert "no people" not in prompt.lower()
        assert "no readable text" in prompt.lower()
        assert "lab" in prompt.lower()
        # Industry attire keeps people plausible in the setting.
        assert "lab coats" in prompt.lower()


def test_build_library_prompt_people_vary_across_cells():
    # One generic prompt would render the same face everywhere; the cast pool must
    # produce different person descriptions across industries and across sections.
    prompts = [
        build_library_prompt(industry, section)
        for industry in ("Healthcare", "Manufacturing", "Legal Services", "Retail")
        for section in ("understand", "implement")
    ]
    people_fragments = {p.split("People: ", 1)[1].split(" Photorealistic", 1)[0] for p in prompts}
    assert len(people_fragments) == len(prompts)


def test_process_card_library_image_endpoint_serves_blob(client, db_session):
    _seed(
        db_session,
        industry_slug_value="healthcare",
        section="understand",
        industry_label="Healthcare",
    )
    r = client.get("/api/recommended-path/process-card-images/healthcare/understand")
    assert r.status_code == 200
    assert r.content == ONE_PX_PNG
    cc = r.headers.get("cache-control", "").lower()
    assert "max-age" in cc
    assert "immutable" in cc


def test_process_card_library_image_endpoint_404_when_missing(client):
    r = client.get("/api/recommended-path/process-card-images/healthcare/manage")
    assert r.status_code == 404


def test_process_card_library_image_endpoint_404_for_bad_section(client, db_session):
    _seed(
        db_session,
        industry_slug_value="healthcare",
        section="understand",
        industry_label="Healthcare",
    )
    r = client.get("/api/recommended-path/process-card-images/healthcare/not-a-section")
    assert r.status_code == 404


def test_attach_hero_urls_returns_library_hrefs_when_seeded(db_session):
    for slug in PROCESS_SECTION_SLUGS:
        _seed(
            db_session, industry_slug_value="healthcare", section=slug, industry_label="Healthcare"
        )
    cards = [
        ("Understand", ["a", "b"]),
        ("Recommend", ["a", "b"]),
        ("Implement", ["a", "b"]),
        ("Manage", ["a", "b"]),
    ]
    urls = rpci.attach_hero_urls(
        db=db_session,
        cards=cards,
        region="",
        industry="Healthcare",
        role="",
        issue="",
        stage="",
        skip_ai=False,
    )
    assert urls == [process_card_library_href("healthcare", s, 1) for s in PROCESS_SECTION_SLUGS]


def test_attach_hero_urls_falls_back_to_generic_when_industry_missing(db_session):
    for slug in PROCESS_SECTION_SLUGS:
        _seed(
            db_session,
            industry_slug_value=GENERIC_INDUSTRY_SLUG,
            section=slug,
            industry_label=GENERIC_INDUSTRY_LABEL,
        )
    urls = attach_hero_urls_from_library(
        db=db_session,
        card_titles=["Understand", "Recommend", "Implement", "Manage"],
        industry="Healthcare",
    )
    assert urls == [
        process_card_library_href(GENERIC_INDUSTRY_SLUG, s, 1) for s in PROCESS_SECTION_SLUGS
    ]


def test_attach_hero_urls_partial_seed_mixes_library_and_none(db_session):
    _seed(
        db_session,
        industry_slug_value="healthcare",
        section="understand",
        industry_label="Healthcare",
    )
    urls = attach_hero_urls_from_library(
        db=db_session,
        card_titles=["Understand", "Recommend", "Implement", "Manage"],
        industry="Healthcare",
    )
    assert urls[0] == process_card_library_href("healthcare", "understand", 1)
    assert urls[1] is None
    assert urls[2] is None
    assert urls[3] is None
