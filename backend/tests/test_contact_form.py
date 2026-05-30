"""Tests for POST /api/contact and SendGrid notification."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

_VALID = {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "company": "Acme Corp",
    "message": "We need help with cloud migration.",
    "phone": "555-0100",
    "industry": "Financial Services",
    "role": "CIO / CTO",
}


def test_contact_accepts_valid_submission():
    with patch("backend.routers.public.send_contact_form_notification"):
        res = client.post("/api/contact", json=_VALID)
    assert res.status_code == 201
    assert "touch" in res.json()["message"].lower()


def test_contact_rejects_invalid_email():
    payload = {**_VALID, "email": "not-an-email"}
    res = client.post("/api/contact", json=payload)
    assert res.status_code == 422


def test_contact_honeypot_silent_success():
    with patch("backend.routers.public.send_contact_form_notification") as mock_send:
        res = client.post("/api/contact", json={**_VALID, "website": "http://spam.example"})
    assert res.status_code == 201
    mock_send.assert_not_called()


def test_contact_queues_sendgrid_notification():
    with patch("backend.routers.public.send_contact_form_notification") as mock_send:
        client.post("/api/contact", json=_VALID)
    # BackgroundTasks run inline in TestClient
    mock_send.assert_called_once()
    kwargs = mock_send.call_args.kwargs
    assert kwargs["name"] == "Jane Doe"
    assert kwargs["email"] == "jane@example.com"
    assert kwargs["company"] == "Acme Corp"


@pytest.mark.parametrize(
    "field",
    ["name", "company", "message"],
)
def test_contact_requires_core_fields(field: str):
    payload = {k: v for k, v in _VALID.items() if k != field}
    res = client.post("/api/contact", json=payload)
    assert res.status_code == 422


def test_send_contact_form_notification_skips_without_api_key():
    from backend.services import email_service

    with patch.object(email_service.settings, "sendgrid_api_key", ""):
        ok, err = email_service.send_contact_form_notification(
            name="Jane",
            email="jane@example.com",
            company="Acme",
            message="Hello",
        )
    assert ok is False
    assert err == "SendGrid not configured"


def test_send_contact_form_notification_calls_sendgrid():
    from backend.services import email_service

    mock_response = type("R", (), {"status_code": 202})()
    mock_sg = type(
        "SG",
        (),
        {"send": lambda self, msg: mock_response},
    )()

    with (
        patch.object(email_service.settings, "sendgrid_api_key", "test-key"),
        patch.object(email_service.settings, "contact_form_to_email", "marketing@pulseone.com"),
        patch.object(email_service, "_get_sg_client", return_value=mock_sg),
    ):
        ok, err = email_service.send_contact_form_notification(
            name="Jane Doe",
            email="jane@example.com",
            company="Acme Corp",
            message="Need help",
            phone="555-0100",
        )

    assert ok is True
    assert err is None
