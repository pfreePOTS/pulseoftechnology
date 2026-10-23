"""Bare postgresql:// URLs must keep using psycopg2.

SQLAlchemy 2.1 (2026-09-24) selects the psycopg v3 driver for driverless
postgresql:// URLs. This project installs psycopg2-binary only, so a 2.1
upgrade crashes at create_engine with ModuleNotFoundError: No module named
'psycopg' (staging Alembic on boot).
"""

from pathlib import Path

from sqlalchemy.engine import make_url


def test_requirements_keep_sqlalchemy_below_2_1():
    requirements = Path(__file__).resolve().parents[1] / "requirements.txt"
    line = next(
        row for row in requirements.read_text().splitlines() if row.startswith("sqlalchemy")
    )
    assert "<2.1" in line


def test_bare_postgresql_url_uses_psycopg2():
    driver = make_url("postgresql://pulse_user:pw@localhost/pulse_db").get_dialect().driver
    assert driver == "psycopg2"
