"""add watched + rename approved to selected in topicstatus

Revision ID: a1b2c3d4e5f6
Revises: b8f1c2d3e4a5
Create Date: 2026-03-31

"""

from collections.abc import Sequence

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "b8f1c2d3e4a5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add the two new enum values to the Postgres type
    op.execute("ALTER TYPE topicstatus ADD VALUE IF NOT EXISTS 'watched'")
    op.execute("ALTER TYPE topicstatus ADD VALUE IF NOT EXISTS 'selected'")
    # Commit so the new values are visible inside the same transaction
    op.execute("COMMIT")
    # 2. Migrate existing 'approved' rows to 'selected'
    op.execute("UPDATE topics SET status = 'selected' WHERE status = 'approved'")


def downgrade() -> None:
    op.execute("UPDATE topics SET status = 'approved' WHERE status = 'selected'")
    op.execute("UPDATE topics SET status = 'approved' WHERE status = 'watched'")
    # Note: Postgres doesn't support removing enum values; the old values stay in the type.
