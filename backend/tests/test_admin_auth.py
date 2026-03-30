"""Admin JWT login, session, and protected routes."""

import jwt
from fastapi.testclient import TestClient

from ..config import settings
from ..dependencies import ADMIN_COOKIE_NAME, decode_admin_token
from ..main import app


def test_login_rejects_wrong_password():
    client = TestClient(app)
    r = client.post("/api/admin/login", json={"password": "wrong-password"})
    assert r.status_code == 401


def test_login_returns_jwt_and_sets_cookie():
    client = TestClient(app)
    r = client.post("/api/admin/login", json={"password": settings.admin_password})
    assert r.status_code == 200
    data = r.json()
    assert data.get("token_type") == "bearer"
    assert "access_token" in data
    decode_admin_token(data["access_token"])
    cookie = r.cookies.get(ADMIN_COOKIE_NAME)
    assert cookie
    decode_admin_token(cookie)


def test_session_reflects_cookie():
    client = TestClient(app)
    assert client.get("/api/admin/session").json() == {"authenticated": False}

    client.post("/api/admin/login", json={"password": settings.admin_password})
    assert client.get("/api/admin/session").json() == {"authenticated": True}


def test_bearer_token_grants_access():
    client = TestClient(app)
    r = client.post("/api/admin/login", json={"password": settings.admin_password})
    token = r.json()["access_token"]
    session = client.get(
        "/api/admin/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session.json() == {"authenticated": True}


def test_logout_clears_session():
    client = TestClient(app)
    client.post("/api/admin/login", json={"password": settings.admin_password})
    assert client.get("/api/admin/session").json()["authenticated"] is True
    client.post("/api/admin/logout")
    assert client.get("/api/admin/session").json() == {"authenticated": False}


def test_invalid_jwt_rejected():
    client = TestClient(app)
    r = client.get(
        "/api/admin/topics",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert r.status_code == 401


def test_expired_jwt_rejected():
    expired = jwt.encode(
        {"sub": "admin", "exp": 1},
        settings.admin_jwt_secret,
        algorithm="HS256",
    )
    client = TestClient(app)
    r = client.get(
        "/api/admin/topics",
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert r.status_code == 401
