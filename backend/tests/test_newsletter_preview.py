"""Admin newsletter HTML preview respects sandbox domain filters."""

from backend.config import settings
from backend.models.topic import AdoptionState, TopicStatus
from backend.tests.domain_fixtures import make_topic


def test_preview_excludes_topics_outside_selected_domains(client, db_session):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    make_topic(
        db_session,
        name="Sandbox Security Only",
        domain_slug="security",
        summary="Unique security sandbox marker.",
        urgency_score=9.0,
        status=TopicStatus.selected,
        adoption_state=AdoptionState.learn_about,
        is_published=False,
    )
    for i in range(5):
        make_topic(
            db_session,
            name=f"Sandbox AI Only {i}",
            domain_slug="ai",
            summary=f"Unique ai sandbox marker {i}.",
            urgency_score=8.0 - (i * 0.1),
            status=TopicStatus.selected,
            adoption_state=AdoptionState.learn_about,
            is_published=False,
        )
    db_session.commit()

    r = client.get("/api/admin/newsletter/preview?domains=ai")
    assert r.status_code == 200
    html = r.text
    assert "Sandbox Security Only" not in html
    assert "Sandbox AI Only" in html
    assert "data-assembly-tier=" in html
    assert "Assembly tier:" in html


def test_preview_domain_filter_is_case_insensitive(client, db_session):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    for i in range(5):
        make_topic(
            db_session,
            name=f"Case Compliance Topic {i}",
            domain_slug="compliance",
            summary="Case compliance summary.",
            urgency_score=7.0,
            status=TopicStatus.watched,
            adoption_state=AdoptionState.learn_about,
            is_published=False,
        )
    db_session.commit()

    r = client.get("/api/admin/newsletter/preview?domains=compliance")
    assert r.status_code == 200
    assert "Case Compliance Topic" in r.text
