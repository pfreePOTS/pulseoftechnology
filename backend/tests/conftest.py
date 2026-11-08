"""Pytest fixtures: in-memory SQLite + admin_users seed for auth tests."""

from __future__ import annotations

import os

# Disable SlowAPI for tests — many specs POST /api/admin/login and hit the 10/min route cap.
os.environ["PULSEONE_TESTING"] = "1"

from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main_mod

# Prevent bootstrap from touching the real DATABASE_URL when TestClient starts lifespan.
main_mod.bootstrap_first_admin_if_empty = lambda: None  # type: ignore[assignment, misc]

from fastapi.testclient import TestClient  # noqa: E402

import backend.models  # noqa: F401,E402 — register models on Base.metadata before create_all
from backend.config import settings  # noqa: E402
from backend.database import Base, get_db  # noqa: E402
from backend.dependencies import ADMIN_COOKIE_NAME, hash_password  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models.admin_mfa_challenge import AdminMfaChallenge  # noqa: E402, F401 — Base.metadata
from backend.models.admin_user import AdminUser  # noqa: E402
from backend.models.agent_run import AgentRun  # noqa: E402, F401 — Base.metadata
from backend.models.hubspot_sync_log import HubSpotSyncLog  # noqa: E402, F401 — Base.metadata
from backend.models.prompt import PromptProposal  # noqa: E402, F401 — Base.metadata
from backend.tests.domain_fixtures import ensure_domains  # noqa: E402

# Scheduler connects to Postgres during lifespan — no-op for unit tests.
main_mod.start_scheduler = lambda: None  # type: ignore[assignment, misc]
main_mod.stop_scheduler = lambda: None  # type: ignore[assignment, misc]

# Fixed MFA code for API tests (environment is development by default).
TEST_ADMIN_MFA_CODE = "246801"


@pytest.fixture(autouse=True)
def _noop_hubspot_background_sync(request: pytest.FixtureRequest):
    """Subscriptions/preferences enqueue HubSpot — stub for API tests; keep real code in test_hubspot_sync."""
    if "test_hubspot_sync" in str(request.path):
        yield
        return
    with patch("backend.services.hubspot_sync.sync_subscriber_to_hubspot", return_value=True):
        yield


@pytest.fixture(autouse=True)
def _admin_mfa_test_defaults(monkeypatch):
    """Every console login requires MFA; tests use a fixed code and mocked SendGrid."""
    monkeypatch.setattr(settings, "admin_mfa_dev_code", TEST_ADMIN_MFA_CODE)
    monkeypatch.setattr(settings, "environment", "development")
    with patch(
        "backend.routers.admin.send_admin_mfa_code_email",
        return_value=True,
    ):
        yield


def login_as_admin(
    client: TestClient,
    *,
    email: str = "pulseoneadmin@pulseone.local",
    password: str | None = None,
    mfa_code: str = TEST_ADMIN_MFA_CODE,
):
    """Password + MFA for any console account (superuser or invited)."""
    pw = password if password is not None else settings.admin_password
    step1 = client.post("/api/admin/login", json={"email": email, "password": pw})
    assert step1.status_code == 200, step1.text
    body = step1.json()
    assert body.get("mfa_required") is True
    assert body.get("mfa_token")
    assert ADMIN_COOKIE_NAME not in step1.cookies or not step1.cookies.get(ADMIN_COOKIE_NAME)
    step2 = client.post(
        "/api/admin/login/mfa",
        json={"mfa_token": body["mfa_token"], "code": mfa_code},
    )
    assert step2.status_code == 200, step2.text
    return step2


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(
        AdminUser(
            email="pulseoneadmin@pulseone.local",
            password_hash=hash_password("pulseadmin"),
            is_superuser=True,
            is_active=True,
            must_change_password=False,
            page_permissions=[],
        )
    )
    session.commit()
    ensure_domains(session)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def _get_db():
        yield db_session

    # BackgroundTasks in routes use SessionLocal(), not get_db — bind it to the test engine.
    test_session_local = sessionmaker(autocommit=False, autoflush=False, bind=db_session.bind)

    app.dependency_overrides[get_db] = _get_db
    with patch("backend.routers.admin.SessionLocal", test_session_local):
        with TestClient(app) as c:
            yield c
    app.dependency_overrides.clear()
