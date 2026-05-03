"""agent_runs: failure_detail for parse/UI diagnostics

Revision ID: 20260427_failure_detail
Revises: 20260426_hubspot_logs
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260427_failure_detail"
down_revision: str | None = "20260426_hubspot_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column("failure_detail", sa.String(length=2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_runs", "failure_detail")
