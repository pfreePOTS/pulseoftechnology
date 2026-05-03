"""Regression: mistaken Postgres role ``pulse`` in DATABASE_URL."""

from backend.config import _normalize_mistaken_pulse_db_role


def test_coerces_pulse_user_in_netloc():
    assert (
        _normalize_mistaken_pulse_db_role("postgresql://pulse:secret@localhost:5532/pulse_db")
        == "postgresql://pulse_user:secret@localhost:5532/pulse_db"
    )


def test_coerces_pulse_without_password():
    assert (
        _normalize_mistaken_pulse_db_role("postgresql://pulse@db:5432/pulse_db")
        == "postgresql://pulse_user@db:5432/pulse_db"
    )


def test_coerces_psycopg2_scheme():
    assert (
        _normalize_mistaken_pulse_db_role("postgresql+psycopg2://pulse:pw@host/db")
        == "postgresql+psycopg2://pulse_user:pw@host/db"
    )


def test_does_not_touch_pulse_user():
    u = "postgresql://pulse_user:pulse_password@localhost:5532/pulse_db"
    assert _normalize_mistaken_pulse_db_role(u) == u
