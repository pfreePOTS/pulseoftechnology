from backend.models.newsletter_issue import NewsletterIssue
from backend.models.role import Role
from backend.models.subscriber import Subscriber
from backend.services.subscriber_tokens import create_subscriber_preferences_token


def _seed_subscriber(db_session) -> Subscriber:
    role = Role(id=10, name="CTO", tags=["AI", "Security"])
    sub = Subscriber(
        email="reader@example.com",
        first_name="Reader",
        last_name="One",
        industries=["Technology"],
        domains=["AI"],
        role_ids=[10],
        is_active=True,
    )
    db_session.add(role)
    db_session.add(sub)
    db_session.commit()
    db_session.refresh(sub)
    return sub


def test_preferences_token_loads_subscriber_preferences(client, db_session):
    sub = _seed_subscriber(db_session)
    token = create_subscriber_preferences_token(sub)

    r = client.get(f"/api/subscriber/preferences?token={token}")

    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "reader@example.com"
    assert data["first_name"] == "Reader"
    assert data["last_name"] == "One"
    assert data["industries"] == ["Technology"]
    assert data["domains"] == ["AI"]
    assert data["role_ids"] == [10]
    assert data["is_active"] is True


def test_preferences_token_updates_subscriber_preferences(client, db_session):
    sub = _seed_subscriber(db_session)
    token = create_subscriber_preferences_token(sub)

    r = client.put(
        f"/api/subscriber/preferences?token={token}",
        json={
            "first_name": "Reader",
            "last_name": "Updated",
            "industries": ["Healthcare", "Technology"],
            "domains": ["Security", "Cloud"],
            "role_ids": [10],
        },
    )

    assert r.status_code == 200
    data = r.json()
    assert data["last_name"] == "Updated"
    assert data["industries"] == ["Healthcare", "Technology"]
    assert data["domains"] == ["Security", "Cloud"]
    db_session.refresh(sub)
    assert sub.last_name == "Updated"
    assert sub.industries == ["Healthcare", "Technology"]
    assert sub.domains == ["Security", "Cloud"]
    assert sub.is_active is True


def test_preferences_update_requires_title_industry_and_domain(client, db_session):
    sub = _seed_subscriber(db_session)
    token = create_subscriber_preferences_token(sub)

    for field in ("role_ids", "industries", "domains"):
        payload = {
            "first_name": "Reader",
            "last_name": "Updated",
            "industries": ["Healthcare"],
            "domains": ["Security"],
            "role_ids": [10],
        }
        payload[field] = []

        r = client.put(f"/api/subscriber/preferences?token={token}", json=payload)

        assert r.status_code == 422


def test_subscribe_requires_title_industry_and_domain(client, db_session):
    db_session.add(Role(id=11, name="CEO", tags=["Leadership"]))
    db_session.commit()
    base_payload = {
        "email": "new@example.com",
        "first_name": "New",
        "last_name": "Reader",
        "industries": ["Technology"],
        "domains": ["AI"],
        "role_ids": [11],
    }

    for field in ("role_ids", "industries", "domains"):
        payload = dict(base_payload)
        payload[field] = None

        r = client.post("/api/subscribe", json=payload)

        assert r.status_code == 422


def test_preferences_token_unsubscribes_subscriber(client, db_session):
    sub = _seed_subscriber(db_session)
    token = create_subscriber_preferences_token(sub)

    r = client.post(f"/api/subscriber/unsubscribe?token={token}")

    assert r.status_code == 200
    assert r.json()["is_active"] is False
    db_session.refresh(sub)
    assert sub.is_active is False


def test_preferences_rejects_invalid_token(client):
    r = client.get("/api/subscriber/preferences?token=not-a-token")

    assert r.status_code == 401


def test_newsletter_issue_can_be_read_online(client, db_session):
    issue = NewsletterIssue(
        token="issue-token",
        subscriber_email="reader@example.com",
        subject="Today",
        html="<html><body><h1>Exact issue</h1></body></html>",
    )
    db_session.add(issue)
    db_session.commit()

    r = client.get("/api/newsletter/issues/issue-token")

    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Exact issue" in r.text
