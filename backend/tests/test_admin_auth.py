"""Admin JWT login, session, and protected routes."""

import jwt
import pytest

from ..config import Settings, settings
from ..dependencies import ADMIN_COOKIE_NAME, decode_admin_token
from ..models.role import Role
from ..models.subscriber import Subscriber
from ..services.subscriber_tokens import create_subscriber_preferences_token


def test_login_rejects_wrong_password(client):
    r = client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": "wrong-password"},
    )
    assert r.status_code == 401


def test_login_returns_jwt_and_sets_cookie(client):
    r = client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("token_type") == "bearer"
    assert "access_token" in data
    assert data.get("must_change_password") is False
    decode_admin_token(data["access_token"])
    cookie = r.cookies.get(ADMIN_COOKIE_NAME)
    assert cookie
    decode_admin_token(cookie)


def test_session_reflects_cookie(client):
    assert client.get("/api/admin/session").json()["authenticated"] is False

    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    data = client.get("/api/admin/session").json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == "pulseoneadmin@pulseone.local"
    assert data["user"]["is_superuser"] is True


def test_invite_can_create_superuser_without_page_permissions(client):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )

    r = client.post(
        "/api/admin/users/invite",
        json={
            "email": "new-admin@example.com",
            "page_permissions": [],
            "is_superuser": True,
            "send_email": False,
        },
    )

    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "new-admin@example.com"
    assert data["is_superuser"] is True

    users = client.get("/api/admin/users").json()
    row = next(u for u in users if u["email"] == "new-admin@example.com")
    assert row["is_superuser"] is True
    assert row["page_permissions"] == []


def test_bearer_token_grants_access(client):
    r = client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    token = r.json()["access_token"]
    session = client.get(
        "/api/admin/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    out = session.json()
    assert out["authenticated"] is True
    assert out["user"]["email"] == "pulseoneadmin@pulseone.local"


def test_logout_clears_session(client):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    assert client.get("/api/admin/session").json()["authenticated"] is True
    client.post("/api/admin/logout")
    assert client.get("/api/admin/session").json()["authenticated"] is False


def test_invalid_jwt_rejected(client):
    r = client.get(
        "/api/admin/topics",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert r.status_code == 401


def test_expired_jwt_rejected(client):
    expired = jwt.encode(
        {"sub": "1", "exp": 1},
        settings.admin_jwt_secret,
        algorithm="HS256",
    )
    r = client.get(
        "/api/admin/topics",
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert r.status_code == 401


def test_subscriber_preferences_token_cannot_authenticate_as_admin(client, db_session):
    db_session.add(
        Subscriber(
            id=1,
            email="subscriber@example.com",
            first_name="Sub",
            last_name="Scriber",
            industries=["Technology"],
            domains=["AI"],
            role_ids=None,
        )
    )
    db_session.commit()
    subscriber = db_session.get(Subscriber, 1)
    assert subscriber is not None
    token = create_subscriber_preferences_token(subscriber)

    r = client.get("/api/admin/session", headers={"Authorization": f"Bearer {token}"})

    assert r.status_code == 200
    assert r.json()["authenticated"] is False


def test_production_rejects_default_admin_and_subscriber_token_secrets():
    with pytest.raises(ValueError):
        Settings(
            _env_file=None,
            environment="production",
            admin_jwt_secret="dev-only-set-ADMIN-JWT-SECRET-in-production",
            subscriber_token_secret="dev-only-set-SUBSCRIBER_TOKEN_SECRET-in-production",
            admin_password="pulseadmin",
            admin_password_hash="",
        )


def test_create_subscriber_requires_auth(client):
    r = client.post(
        "/api/admin/subscribers",
        json={
            "email": "new@example.com",
            "first_name": "Test",
            "last_name": "User",
            "industries": ["Technology"],
            "domains": ["AI"],
            "role_ids": [1],
            "is_active": True,
        },
    )
    assert r.status_code == 401


def test_update_subscriber_requires_auth(client):
    r = client.put(
        "/api/admin/subscribers/1",
        json={
            "email": "x@example.com",
            "first_name": "A",
            "last_name": "B",
            "industries": ["Technology"],
            "domains": ["AI"],
            "role_ids": [1],
            "is_active": True,
        },
    )
    assert r.status_code == 401


def test_admin_create_subscriber_requires_title_industry_and_domain(client, db_session):
    db_session.add(Role(id=20, name="COO", tags=["Leadership"]))
    db_session.commit()
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    base_payload = {
        "email": "admin-added@example.com",
        "first_name": "Admin",
        "last_name": "Added",
        "industries": ["Technology"],
        "domains": ["AI"],
        "role_ids": [20],
        "is_active": True,
    }

    for field in ("role_ids", "industries", "domains"):
        payload = dict(base_payload)
        payload[field] = []

        r = client.post("/api/admin/subscribers", json=payload)

        assert r.status_code == 422


def test_delete_subscriber_requires_auth(client):
    r = client.delete("/api/admin/subscribers/1")
    assert r.status_code == 401


def test_newsletter_preview_filters_requires_auth(client):
    r = client.get("/api/admin/newsletter/preview-filters")
    assert r.status_code == 401


def test_newsletter_test_send_requires_auth(client):
    r = client.post(
        "/api/admin/newsletter/test-send",
        json={"to_email": "curator@example.com"},
    )
    assert r.status_code == 401


def test_analysis_industry_suggest_all_background_requires_auth(client):
    r = client.post("/api/admin/topics/analysis/industry-suggest-all-background")
    assert r.status_code == 401


def test_analysis_persona_suggest_all_background_requires_auth(client):
    r = client.post("/api/admin/topics/analysis/persona-suggest-all-background")
    assert r.status_code == 401


def test_analysis_background_jobs_queue_when_authed(client):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    r_ind = client.post("/api/admin/topics/analysis/industry-suggest-all-background")
    assert r_ind.status_code == 200
    assert r_ind.json().get("status") == "queued"
    r_per = client.post("/api/admin/topics/analysis/persona-suggest-all-background")
    assert r_per.status_code == 200
    assert r_per.json().get("status") == "queued"
