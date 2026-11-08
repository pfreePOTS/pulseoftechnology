"""Email MFA challenge helpers for every console (admin_users) password login."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..config import settings
from ..dependencies import create_admin_mfa_token, hash_password, verify_password
from ..models.admin_mfa_challenge import AdminMfaChallenge
from ..models.admin_user import AdminUser


def generate_mfa_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _dev_code_allowed() -> bool:
    env = settings.environment.strip().lower()
    return env not in {"production", "staging"} and bool(settings.admin_mfa_dev_code.strip())


def invalidate_open_challenges(db: Session, user_id: int) -> None:
    now = datetime.now(UTC)
    open_rows = (
        db.query(AdminMfaChallenge)
        .filter(
            AdminMfaChallenge.user_id == user_id,
            AdminMfaChallenge.consumed_at.is_(None),
        )
        .all()
    )
    for row in open_rows:
        row.consumed_at = now


def create_challenge(db: Session, user: AdminUser) -> tuple[AdminMfaChallenge, str, str]:
    """
    Create a new MFA challenge for ``user``.

    Returns (challenge_row, plaintext_code, mfa_token).
    """
    invalidate_open_challenges(db, user.id)
    code = generate_mfa_code()
    challenge_id = str(uuid.uuid4())
    ttl = settings.admin_mfa_code_ttl_minutes
    row = AdminMfaChallenge(
        user_id=user.id,
        challenge_id=challenge_id,
        code_hash=hash_password(code),
        expires_at=datetime.now(UTC) + timedelta(minutes=ttl),
        consumed_at=None,
        attempt_count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    token = create_admin_mfa_token(user_id=user.id, challenge_id=challenge_id, ttl_minutes=ttl)
    return row, code, token


def _code_matches(row: AdminMfaChallenge, code: str) -> bool:
    cleaned = code.strip()
    if verify_password(cleaned, row.code_hash):
        return True
    if _dev_code_allowed() and cleaned == settings.admin_mfa_dev_code.strip():
        return True
    return False


def verify_challenge(
    db: Session, *, user_id: int, challenge_id: str, code: str
) -> AdminMfaChallenge | None:
    """
    Verify MFA code. On success marks the challenge consumed and returns it.
    On failure increments attempt_count (and may consume when locked). Returns None.
    """
    row = (
        db.query(AdminMfaChallenge)
        .filter(
            AdminMfaChallenge.challenge_id == challenge_id,
            AdminMfaChallenge.user_id == user_id,
        )
        .first()
    )
    if row is None or row.consumed_at is not None:
        return None
    now = datetime.now(UTC)
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < now:
        row.consumed_at = now
        db.commit()
        return None
    if row.attempt_count >= settings.admin_mfa_max_attempts:
        row.consumed_at = now
        db.commit()
        return None
    if not _code_matches(row, code):
        row.attempt_count += 1
        if row.attempt_count >= settings.admin_mfa_max_attempts:
            row.consumed_at = now
        db.commit()
        return None
    row.consumed_at = now
    db.commit()
    db.refresh(row)
    return row


def get_open_challenge(db: Session, *, user_id: int, challenge_id: str) -> AdminMfaChallenge | None:
    row = (
        db.query(AdminMfaChallenge)
        .filter(
            AdminMfaChallenge.challenge_id == challenge_id,
            AdminMfaChallenge.user_id == user_id,
            AdminMfaChallenge.consumed_at.is_(None),
        )
        .first()
    )
    if row is None:
        return None
    now = datetime.now(UTC)
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < now:
        return None
    return row
