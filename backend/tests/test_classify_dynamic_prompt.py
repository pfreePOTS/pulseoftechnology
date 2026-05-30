"""Dynamic classifier prompt tests."""

from backend.services.domain_registry import render_classify_system_prompt, resolve_domain
from backend.tests.domain_fixtures import ensure_domains


def test_classify_prompt_from_registry(db_session):
    ensure_domains(db_session)
    prompt = render_classify_system_prompt(db_session)
    for label in ("AI", "Security", "Cloud", "Storage", "Compliance", "Infrastructure"):
        assert label in prompt


def test_unknown_domain_becomes_candidate(db_session):
    ensure_domains(db_session)
    row = resolve_domain(db_session, "Robotics")
    assert row.slug == "robotics"
    assert row.status == "candidate"
