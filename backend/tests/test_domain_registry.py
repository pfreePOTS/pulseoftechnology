"""Domain registry tests."""

from backend.models.domain import Domain, DomainStatus
from backend.services.domain_registry import (
    render_classify_system_prompt,
    resolve_domain,
    slugify_domain,
    validate_subscriber_domain_slugs,
)
from backend.tests.domain_fixtures import ensure_domains, make_topic


def test_slugify_domain_legacy_labels(db_session):
    assert slugify_domain("AI") == "ai"
    assert slugify_domain("Finance") == "compliance"
    # Leadership retired — must not collapse into the AI pillar (PULSE-018).
    assert slugify_domain("Leadership") == "other"


def test_migrate_subscriber_domain_list_drops_leadership(db_session):
    from backend.services.domain_registry import migrate_subscriber_domain_list

    assert migrate_subscriber_domain_list(["Leadership", "Security"]) == ["security"]
    assert migrate_subscriber_domain_list(["leadership"]) is None


def test_resolve_domain_auto_creates_candidate(db_session):
    ensure_domains(db_session)
    row = resolve_domain(db_session, "Quantum Computing")
    assert row.status == DomainStatus.candidate.value
    assert row.slug == "quantum-computing"


def test_resolve_domain_deprecated_merges(db_session):
    ensure_domains(db_session)
    target = db_session.query(Domain).filter(Domain.slug == "ai").one()
    deprecated = Domain(
        slug="legacy-ai",
        label="Legacy AI",
        short_label="Legacy AI",
        color="#000",
        status=DomainStatus.deprecated.value,
        merged_into_id=target.id,
    )
    db_session.add(deprecated)
    db_session.commit()
    resolved = resolve_domain(db_session, "legacy-ai", auto_create_candidate=False)
    assert resolved.id == target.id


def test_render_classify_prompt_excludes_finance_leadership(db_session):
    ensure_domains(db_session)
    prompt = render_classify_system_prompt(db_session)
    assert "Storage" in prompt
    assert "Compliance" in prompt
    assert "Infrastructure" in prompt
    assert "Finance" not in prompt
    assert "Leadership" not in prompt


def test_validate_subscriber_domain_slugs(db_session):
    ensure_domains(db_session)
    slugs = validate_subscriber_domain_slugs(db_session, ["ai", "security"])
    assert slugs == ["ai", "security"]


def test_make_topic_uses_domain_id(db_session):
    topic = make_topic(db_session, name="Test topic", domain_slug="storage")
    assert topic.domain.short_label == "Storage"
