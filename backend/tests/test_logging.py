"""Operational logging coverage for auth, subscribe, jobs, and public LLM routes."""

from __future__ import annotations

import logging
from unittest.mock import patch

from backend.config import settings
from backend.log_events import client_ip, kv
from backend.models.role import Role
from backend.models.subscriber import Subscriber
from backend.scheduler import _hubspot_batch_job
from backend.services.subscriber_tokens import create_subscriber_preferences_token
from backend.tests.domain_fixtures import ensure_domains


def test_kv_renders_scalar_and_list_fields():
    assert kv(email="a@b.com", count=3) == "email=a@b.com count=3"
    assert kv(domains=["ai", "security"]) == "domains=ai,security"
    assert kv(skip_ai=True) == "skip_ai=true"
    assert kv(empty="", missing=None) == ""


def test_client_ip_unknown_when_no_request():
    assert client_ip(None) == "unknown"


def test_login_failure_logs_warning(client, caplog):
    with caplog.at_level(logging.WARNING, logger="backend.routers.admin"):
        r = client.post(
            "/api/admin/login",
            json={"email": "pulseoneadmin@pulseone.local", "password": "wrong-password"},
        )
    assert r.status_code == 401
    assert any("[auth] login_failed" in rec.message for rec in caplog.records)


def test_login_success_logs_info(client, caplog):
    with caplog.at_level(logging.INFO, logger="backend.routers.admin"):
        r = client.post(
            "/api/admin/login",
            json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
        )
    assert r.status_code == 200
    assert any("[auth] login_success" in rec.message for rec in caplog.records)
    success = next(rec for rec in caplog.records if "[auth] login_success" in rec.message)
    assert "email=pulseoneadmin@pulseone.local" in success.message


def test_logout_logs_info(client, caplog):
    client.post(
        "/api/admin/login",
        json={"email": "pulseoneadmin@pulseone.local", "password": settings.admin_password},
    )
    with caplog.at_level(logging.INFO, logger="backend.routers.admin"):
        client.post("/api/admin/logout")
    assert any("[auth] logout" in rec.message for rec in caplog.records)


def test_unauthenticated_admin_route_logs_info(client, caplog):
    with caplog.at_level(logging.INFO, logger="backend.dependencies"):
        r = client.get("/api/admin/topics")
    assert r.status_code == 401
    assert any("[auth] unauthenticated" in rec.message for rec in caplog.records)


def test_invalid_jwt_logs_warning(client, caplog):
    with caplog.at_level(logging.WARNING, logger="backend.dependencies"):
        r = client.get(
            "/api/admin/topics",
            headers={"Authorization": "Bearer not-a-real-jwt"},
        )
    assert r.status_code == 401
    assert any("[auth] invalid_token" in rec.message for rec in caplog.records)


def test_subscribe_signup_logs_info(client, db_session, caplog):
    ensure_domains(db_session)
    db_session.add(Role(id=21, name="CTO", tags=["Leadership"]))
    db_session.commit()
    payload = {
        "email": "logging-signup@example.com",
        "first_name": "Log",
        "last_name": "Signup",
        "industries": ["Technology"],
        "domains": ["ai"],
        "role_ids": [21],
    }
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.post("/api/subscribe", json=payload)
    assert r.status_code == 201
    assert any("[subscribe] signup" in rec.message for rec in caplog.records)
    signup = next(rec for rec in caplog.records if "[subscribe] signup" in rec.message)
    assert "email=logging-signup@example.com" in signup.message


def test_subscribe_duplicate_logs_info(client, db_session, caplog):
    ensure_domains(db_session)
    db_session.add(Role(id=22, name="CEO", tags=["Leadership"]))
    sub = Subscriber(
        email="dup@example.com",
        first_name="Dup",
        last_name="User",
        industries=["Technology"],
        domains=["ai"],
        role_ids=[22],
        is_active=True,
    )
    db_session.add(sub)
    db_session.commit()
    payload = {
        "email": "dup@example.com",
        "first_name": "Dup",
        "last_name": "User",
        "industries": ["Technology"],
        "domains": ["ai"],
        "role_ids": [22],
    }
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.post("/api/subscribe", json=payload)
    assert r.status_code == 409
    assert any("[subscribe] duplicate" in rec.message for rec in caplog.records)


def test_subscribe_reactivate_logs_info(client, db_session, caplog):
    ensure_domains(db_session)
    db_session.add(Role(id=23, name="CFO", tags=["Leadership"]))
    sub = Subscriber(
        email="lapsed@example.com",
        first_name="Lapsed",
        last_name="User",
        industries=["Technology"],
        domains=["ai"],
        role_ids=[23],
        is_active=False,
    )
    db_session.add(sub)
    db_session.commit()
    payload = {
        "email": "lapsed@example.com",
        "first_name": "Lapsed",
        "last_name": "User",
        "industries": ["Technology"],
        "domains": ["security"],
        "role_ids": [23],
    }
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.post("/api/subscribe", json=payload)
    assert r.status_code == 201
    assert any("[subscribe] reactivate" in rec.message for rec in caplog.records)


def test_unsubscribe_logs_info(client, db_session, caplog):
    ensure_domains(db_session)
    db_session.add(Role(id=10, name="CTO", tags=["AI"]))
    sub = Subscriber(
        email="reader@example.com",
        first_name="Reader",
        last_name="One",
        industries=["Technology"],
        domains=["ai"],
        role_ids=[10],
        is_active=True,
    )
    db_session.add(sub)
    db_session.commit()
    token = create_subscriber_preferences_token(sub)
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.post(f"/api/subscriber/unsubscribe?token={token}")
    assert r.status_code == 200
    assert any("[subscribe] unsubscribe" in rec.message for rec in caplog.records)


def test_preferences_update_logs_info(client, db_session, caplog):
    ensure_domains(db_session)
    db_session.add(Role(id=10, name="CTO", tags=["AI"]))
    sub = Subscriber(
        email="reader@example.com",
        first_name="Reader",
        last_name="One",
        industries=["Technology"],
        domains=["ai"],
        role_ids=[10],
        is_active=True,
    )
    db_session.add(sub)
    db_session.commit()
    token = create_subscriber_preferences_token(sub)
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.put(
            f"/api/subscriber/preferences?token={token}",
            json={
                "first_name": "Reader",
                "last_name": "Updated",
                "industries": ["Healthcare"],
                "domains": ["security"],
                "role_ids": [10],
            },
        )
    assert r.status_code == 200
    assert any("[subscribe] preferences_updated" in rec.message for rec in caplog.records)


def test_invalid_preferences_token_logs_warning(client, caplog):
    with caplog.at_level(logging.WARNING, logger="backend.routers.public"):
        r = client.get("/api/subscriber/preferences?token=not-a-token")
    assert r.status_code == 401
    assert any("[subscribe] invalid_preferences_token" in rec.message for rec in caplog.records)


def test_contact_submission_logs_inline_metadata(client, caplog):
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.post(
            "/api/contact",
            json={
                "name": "Pat Example",
                "email": "pat@example.com",
                "company": "Example Co",
                "message": "Hello from the contact form.",
            },
        )
    assert r.status_code == 201
    contact = next(rec for rec in caplog.records if "[contact] inbound submission" in rec.message)
    assert "contact_email=pat@example.com" in contact.message
    assert 'contact_company="Example Co"' in contact.message


def test_hubspot_batch_job_logs_start_and_finish(caplog):
    with (
        patch.object(settings, "hubspot_api_key", "test-key"),
        patch.object(settings, "hubspot_batch_sync_enabled", True),
        patch(
            "backend.services.hubspot_sync.reconcile_all_subscribers_to_hubspot",
            return_value={"ok": True},
        ) as mock_reconcile,
        caplog.at_level(logging.INFO, logger="backend.scheduler"),
    ):
        _hubspot_batch_job()
    mock_reconcile.assert_called_once_with(source="scheduled_batch")
    messages = [rec.message for rec in caplog.records]
    assert any("[job] hubspot_batch started" in m for m in messages)
    assert any("[job] hubspot_batch finished" in m for m in messages)


def test_manual_ingest_job_logs_lifecycle(caplog):
    from backend.routers.admin import _run_ingest

    with (
        patch("backend.routers.admin.run_all_sources") as mock_ingest,
        caplog.at_level(logging.INFO, logger="backend.routers.admin"),
    ):
        _run_ingest()
    mock_ingest.assert_called_once()
    messages = [rec.message for rec in caplog.records]
    assert any("[job] manual_ingest started" in m for m in messages)
    assert any("[job] manual_ingest finished" in m for m in messages)


def test_recommended_path_logs_ok(client, db_session, caplog):
    ensure_domains(db_session)
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.get(
            "/api/recommended-path",
            params={
                "industry": "Technology",
                "role": "CTO",
                "issue": "AI",
                "stage": "We need a plan for generative AI adoption.",
                "skip_ai": "true",
            },
        )
    assert r.status_code == 200
    assert any("[recommended-path] ok" in rec.message for rec in caplog.records)


def test_everyone_overview_logs_ok(client, db_session, caplog):
    ensure_domains(db_session)
    with caplog.at_level(logging.INFO, logger="backend.routers.public"):
        r = client.get("/api/everyone-overview")
    assert r.status_code == 200
    assert any("[everyone-overview] ok" in rec.message for rec in caplog.records)
