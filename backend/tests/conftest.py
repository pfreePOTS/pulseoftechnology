"""Pytest fixtures: in-memory SQLite + admin_users seed for auth tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main_mod

# Prevent bootstrap from touching the real DATABASE_URL when TestClient starts lifespan.
main_mod.bootstrap_first_admin_if_empty = lambda: None  # type: ignore[assignment, misc]

from fastapi.testclient import TestClient  # noqa: E402

from backend.database import Base, get_db  # noqa: E402
from backend.dependencies import hash_password  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models.admin_user import AdminUser  # noqa: E402
from backend.models.agent_run import AgentRun  # noqa: E402, F401 — Base.metadata
from backend.models.prompt import PromptProposal  # noqa: E402, F401 — Base.metadata

# Scheduler connects to Postgres during lifespan — no-op for unit tests.
main_mod.start_scheduler = lambda: None  # type: ignore[assignment, misc]
main_mod.stop_scheduler = lambda: None  # type: ignore[assignment, misc]


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
