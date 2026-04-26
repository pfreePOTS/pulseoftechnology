"""Admin newsletter HTML preview respects sandbox domain filters."""

from backend.config import settings
from backend.models.topic import AdoptionState, Topic, TopicStatus


def test_preview_excludes_topics_outside_selected_domains(client, db_session):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    db_session.add(
        Topic(
            name="Sandbox Security Only",
            domain="Security",
            subdomain="",
            summary="Unique security sandbox marker.",
            urgency_score=9.0,
            status=TopicStatus.selected,
            adoption_state=AdoptionState.learn_about,
            is_published=False,
        )
    )
    db_session.add(
        Topic(
            name="Sandbox Leadership Only",
            domain="Leadership",
            subdomain="",
            summary="Unique leadership sandbox marker.",
            urgency_score=8.0,
            status=TopicStatus.selected,
            adoption_state=AdoptionState.learn_about,
            is_published=False,
        )
    )
    db_session.commit()

    r = client.get("/api/admin/newsletter/preview?domains=Leadership")
    assert r.status_code == 200
    html = r.text
    assert "Sandbox Security Only" not in html
    assert "Sandbox Leadership Only" in html


def test_preview_domain_filter_is_case_insensitive(client, db_session):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    db_session.add(
        Topic(
            name="Case Finance Topic",
            domain="Finance",
            subdomain="",
            summary="Case finance summary.",
            urgency_score=7.0,
            status=TopicStatus.watched,
            adoption_state=AdoptionState.learn_about,
            is_published=False,
        )
    )
    db_session.commit()

    r = client.get("/api/admin/newsletter/preview?domains=finance")
    assert r.status_code == 200
    assert "Case Finance Topic" in r.text
