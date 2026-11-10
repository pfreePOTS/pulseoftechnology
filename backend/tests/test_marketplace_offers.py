"""Marketplace Content Library path helpers."""

from __future__ import annotations

from backend.marketplace_offers import (
    legacy_landing_pdf_path,
    offer_image_path,
    offer_landing_pdf_path,
    offer_pdf_filename,
)


def test_offer_pdf_filename_is_kebab_case():
    assert (
        offer_pdf_filename("Endpoint Management Assessment for Microsoft Intune")
        == "endpoint-management-assessment-for-microsoft-intune.pdf"
    )
    assert (
        offer_pdf_filename("AI Readiness, Security, and Governance Assessment for Microsoft 365")
        == "ai-readiness-security-and-governance-assessment-for-microsoft-365.pdf"
    )


def test_offer_landing_pdf_path_uses_service_offers_and_title_slug():
    assert (
        offer_landing_pdf_path("5")
        == "/service-offers/endpoint-management-assessment-for-microsoft-intune.pdf"
    )
    assert (
        offer_landing_pdf_path("23")
        == "/service-offers/app-protection-policy-assessment-for-microsoft-intune.pdf"
    )


def test_legacy_landing_pdf_path_preserved_for_redirects():
    assert legacy_landing_pdf_path("05") == "/marketplace-offers/PulseOne_05_landing.pdf"


def test_offer_image_path_unchanged():
    assert offer_image_path("09") == "/marketplace-offers/PulseOne_09_promo_1280x720.png"
