"""Tests for domain gating on the public tracked-articles surface."""

from types import SimpleNamespace

import pytest

from ..services.tracked_article_filter import (
    article_qualifies_pulse_tracked_surface,
    tracked_finance_article_has_pulse_tech_signals,
    tracked_leadership_article_has_pulse_tech_signals,
)


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
    assert tracked_finance_article_has_pulse_tech_signals(
        "Quarterly outlook",
        "Central bank policy",
        "Rates unchanged; focus on inflation path.",
    ) is False

    assert tracked_finance_article_has_pulse_tech_signals(
        "Core banking modernization",
        "Cloud migration roadmap",
        "API-first architecture for lending.",
    ) is True


def test_tracked_leadership_signals_helper():
    assert tracked_leadership_article_has_pulse_tech_signals(
        "Store managers under pressure",
        "Coaching and morale at risk",
        "Layoffs and DEI backlash without new systems or tooling.",
    ) is False

    assert tracked_leadership_article_has_pulse_tech_signals(
        "Collaboration stack shapes remote leadership",
        "Microsoft Teams rollout and Slack adoption targets",
        None,
    ) is True
