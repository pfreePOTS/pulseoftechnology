"""Tests for domain gating on the public tracked-articles surface."""

from types import SimpleNamespace

import pytest

from ..services.tracked_article_filter import (
    article_qualifies_pulse_tracked_surface,
    infer_pulse_domain,
    text_has_general_pulse_tech_signal,
    tracked_finance_article_has_pulse_tech_signals,
    tracked_leadership_article_has_pulse_tech_signals,
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("The era of chatbot AIOps is fading as agentic AI gains traction", "AI"),
        ("AI Finds 38 Security Flaws in Electronic Health Record Platform", "AI"),
        ("Reverse Engineering With AI Unearths High-Severity GitHub Bug", "AI"),
        ("OpenAI launches enterprise GPT model", "AI"),
        ("Ransomware crew claims new Fortune 500 victim", "Security"),
        ("CVE-2026-12345 disclosed in widely deployed library", "Security"),
        ("AWS unveils next-gen Kubernetes-managed serverless tier", "Cloud"),
        ("Snowflake doubles down on Databricks-style analytics", "Cloud"),
        ("FinTech startup aims at core banking platform overhaul", "Finance"),
        ("CIO says digital transformation is the priority for 2026", "Leadership"),
        ("Risk of paralysis, bacteria, even death is no match for raw milk", None),
        (
            "More airport disruptions may be coming as White House warns pay for TSA workers will run out",
            None,
        ),
        ("Trump spent nearly $2 billion of taxpayer money to undo wind projects", None),
    ],
)
def test_infer_pulse_domain_recognises_clear_pulse_categories(text, expected):
    assert infer_pulse_domain(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Raw milk popularity surges despite warnings", False),
        ("Trump signs executive order on wind projects", False),
        (
            "Anthropic Claude expands to financial services with cybersecurity guardrails",
            True,
        ),
        ("Cloud migration accelerates Kubernetes adoption", True),
        ("This celebrity feature has nothing to do with technology", False),
    ],
)
def test_text_has_general_pulse_tech_signal(text, expected):
    assert text_has_general_pulse_tech_signal(text) is expected


def _article(domain: str, *, title: str, what=None, content=None):
    return SimpleNamespace(
        id=1,
        title=title,
        what_is_it=what,
        content=content,
        topic=SimpleNamespace(domain=domain),
    )


@pytest.mark.parametrize(
    "domain",
    ("AI", "Security", "Cloud", "Retail"),
)
def test_domains_without_finance_leadership_pulse_filter_qualify(domain):
    a = _article(
        domain,
        title="Any headline",
        what="Any teaser",
        content="No tech required for these domains here.",
    )
    assert article_qualifies_pulse_tracked_surface(a) is True


@pytest.mark.parametrize(
    ("title", "what", "content", "expect"),
    [
        (
            "Bank rolls out MFA for treasury portal",
            None,
            "Rollout timeline and vendor partners.",
            True,
        ),
        (
            "Fed holds steady on rates",
            "Powell press conference takeaway",
            "No change to target range.",
            False,
        ),
        (
            "Meta test",
            None,
            "Meta explores stablecoin payouts for creators.",
            True,
        ),
    ],
)
def test_finance_tech_signals(title, what, content, expect):
    a = _article("Finance", title=title, what=what, content=content)
    assert article_qualifies_pulse_tracked_surface(a) is expect


@pytest.mark.parametrize(
    ("title", "what", "content", "expect"),
    [
        (
            "Retail leadership under pressure",
            "DEI and thinning management test store culture.",
            (
                "Retail faces conflicting pressures: DEI reversals risk alienating diverse "
                "customer bases, while middle-manager elimination reduces store-level coaching "
                "and customer service quality."
            ),
            False,
        ),
        (
            "CISO steers security culture",
            "Incident response and board reporting.",
            "The CISO is hiring and zero-trust timeline for retail IT.",
            True,
        ),
        (
            "Digital transformation reshapes frontline leadership",
            "Workday and training stack rollouts across regions.",
            None,
            True,
        ),
    ],
)
def test_leadership_tech_signals(title, what, content, expect):
    a = _article("Leadership", title=title, what=what, content=content)
    assert article_qualifies_pulse_tracked_surface(a) is expect


def test_tracked_finance_signals_helper():
    assert (
        tracked_finance_article_has_pulse_tech_signals(
            "Quarterly outlook",
            "Central bank policy",
            "Rates unchanged; focus on inflation path.",
        )
        is False
    )

    assert (
        tracked_finance_article_has_pulse_tech_signals(
            "Core banking modernization",
            "Cloud migration roadmap",
            "API-first architecture for lending.",
        )
        is True
    )


def test_tracked_leadership_signals_helper():
    assert (
        tracked_leadership_article_has_pulse_tech_signals(
            "Store managers under pressure",
            "Coaching and morale at risk",
            "Layoffs and DEI backlash without new systems or tooling.",
        )
        is False
    )

    assert (
        tracked_leadership_article_has_pulse_tech_signals(
            "Collaboration stack shapes remote leadership",
            "Microsoft Teams rollout and Slack adoption targets",
            None,
        )
        is True
    )
