"""Admin HubSpot status and log fields for contact-form deals."""

from datetime import UTC, datetime
from unittest.mock import patch

from backend.config import settings
from backend.models.hubspot_sync_log import HubSpotSyncLog
from backend.tests.conftest import login_as_admin


def test_hubspot_status_reports_contact_deal_config(client, monkeypatch):
    monkeypatch.setattr(settings, "hubspot_contact_deal_pipeline_id", "pipe-connected")
    monkeypatch.setattr(settings, "hubspot_contact_deal_stage_id", "")
    login_as_admin(client)
    response = client.get("/api/admin/hubspot/status")
    assert response.status_code == 200
    body = response.json()
    assert body["contact_deal_pipeline_configured"] is True
    assert body["contact_deal_stage_configured"] is False


def test_hubspot_test_connection_returns_object_checks(client):
    payload = {
        "ok": False,
        "error": "deals: missing scope",
        "checks": {
            "contacts": {"ok": True, "error": None},
            "companies": {"ok": False, "error": "403"},
            "deals": {"ok": False, "error": "403"},
        },
    }
    login_as_admin(client)
    with patch("backend.routers.admin.test_hubspot_crm_access", return_value=payload):
        response = client.post("/api/admin/hubspot/test-connection")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["checks"]["contacts"]["ok"] is True
    assert body["checks"]["deals"]["ok"] is False


def test_hubspot_logs_include_company_and_deal_ids(client, db_session):
    db_session.add(
        HubSpotSyncLog(
            created_at=datetime.now(UTC),
            subscriber_id=None,
            email="jane@acme.com",
            source="contact_form",
            operation="deal_created",
            success=True,
            hubspot_contact_id="c1",
            hubspot_company_id="co1",
            hubspot_deal_id="d1",
            payload={"deal": {"dealname": "Acme Corp — Jane Doe"}},
            error_message=None,
        )
    )
    db_session.commit()
    login_as_admin(client)
    response = client.get("/api/admin/hubspot/logs")
    assert response.status_code == 200
    row = response.json()["logs"][0]
    assert row["source"] == "contact_form"
    assert row["hubspot_company_id"] == "co1"
    assert row["hubspot_deal_id"] == "d1"
    assert row["subscriber_id"] is None
