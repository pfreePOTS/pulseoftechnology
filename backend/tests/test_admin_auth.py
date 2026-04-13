"""Admin JWT login, session, and protected routes."""

import jwt

from ..config import settings
from ..dependencies import ADMIN_COOKIE_NAME, decode_admin_token


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


def test_create_subscriber_requires_auth(client):
    r = client.post(
        "/api/admin/subscribers",
        json={
            "email": "new@example.com",
            "first_name": "Test",
            "last_name": "User",
            "industries": ["Technology"],
            "domains": ["AI"],
            "role_ids": None,
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
            "industries": None,
            "domains": None,
            "role_ids": None,
            "is_active": True,
        },
    )
    assert r.status_code == 401


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
