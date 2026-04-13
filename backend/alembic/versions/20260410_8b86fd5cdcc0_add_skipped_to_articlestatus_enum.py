"""add skipped to articlestatus enum

Revision ID: 8b86fd5cdcc0
Revises: ee5f8ff37bb7
Create Date: 2026-04-10 21:07:11.999370+00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8b86fd5cdcc0"
down_revision: Union[str, None] = "ee5f8ff37bb7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE articlestatus ADD VALUE IF NOT EXISTS 'skipped'")
    op.execute("ALTER TYPE articlestatus ADD VALUE IF NOT EXISTS 'retry'")


def downgrade() -> None:
    op.execute("UPDATE articles SET status = 'processed' WHERE status = 'skipped'")
    op.execute("UPDATE articles SET status = 'processed' WHERE status = 'retry'")
