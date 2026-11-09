"""Unit tests for admin MFA challenge helpers and JWT typ separation."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from backend.config import settings
from backend.dependencies import (
    create_admin_access_token,
    create_admin_mfa_token,
    decode_admin_mfa_token,
    decode_admin_token,
)
from backend.models.admin_user import AdminUser
from backend.services import admin_mfa


def test_mfa_token_is_not_valid_as_admin_session():
    token = create_admin_mfa_token(user_id=1, challenge_id="cid-1", ttl_minutes=10)
    with pytest.raises(jwt.InvalidTokenError):
        decode_admin_token(token)
    payload = decode_admin_mfa_token(token)
    assert payload["cid"] == "cid-1"
    assert payload["sub"] == "1"


def test_admin_session_token_is_not_valid_as_mfa(db_session):
    user = db_session.query(AdminUser).first()
    assert user is not None
    token = create_admin_access_token(user)
    with pytest.raises(jwt.InvalidTokenError):
        decode_admin_mfa_token(token)


def test_create_and_verify_challenge(db_session, monkeypatch):
    monkeypatch.setattr(settings, "admin_mfa_dev_code", "")
    user = db_session.query(AdminUser).first()
    assert user is not None
    row, code, token = admin_mfa.create_challenge(db_session, user)
    assert len(code) == 6
    assert code.isdigit()
    assert row.challenge_id
    payload = decode_admin_mfa_token(token)
    assert payload["cid"] == row.challenge_id

    assert (
        admin_mfa.verify_challenge(
            db_session, user_id=user.id, challenge_id=row.challenge_id, code="000000"
        )
        is None
    )
    db_session.refresh(row)
    assert row.attempt_count == 1
    assert row.consumed_at is None

    ok = admin_mfa.verify_challenge(
        db_session, user_id=user.id, challenge_id=row.challenge_id, code=code
    )
    assert ok is not None
    assert ok.consumed_at is not None


def test_dev_code_accepted_outside_production(db_session, monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "admin_mfa_dev_code", "246801")
    user = db_session.query(AdminUser).first()
    assert user is not None
    row, _code, _token = admin_mfa.create_challenge(db_session, user)
    ok = admin_mfa.verify_challenge(
        db_session, user_id=user.id, challenge_id=row.challenge_id, code="246801"
    )
    assert ok is not None


def test_expired_challenge_rejected(db_session, monkeypatch):
    monkeypatch.setattr(settings, "admin_mfa_dev_code", "")
    user = db_session.query(AdminUser).first()
    assert user is not None
    row, code, _token = admin_mfa.create_challenge(db_session, user)
    row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()
    assert (
        admin_mfa.verify_challenge(
            db_session, user_id=user.id, challenge_id=row.challenge_id, code=code
        )
        is None
    )
