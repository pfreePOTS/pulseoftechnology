"""Marketplace Content Library path helpers."""

from __future__ import annotations

from backend.marketplace_offers import offer_image_path, offer_landing_pdf_path


def test_offer_landing_pdf_path_matches_asset_id():
    assert offer_landing_pdf_path("1") == "/marketplace-offers/PulseOne_01_landing.pdf"
    assert offer_landing_pdf_path("23") == "/marketplace-offers/PulseOne_23_landing.pdf"


def test_offer_image_path_unchanged():
    assert offer_image_path("09") == "/marketplace-offers/PulseOne_09_promo_1280x720.png"
