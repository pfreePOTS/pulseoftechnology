"""topics.selected_at — when the topic was promoted to on-radar (selected)

Revision ID: 20260416_topic_selected_at
Revises: 20260415_agent_run_metrics
Create Date: 2026-04-16

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260416_topic_selected_at"
down_revision: str | None = "20260415_agent_run_metrics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column("selected_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("topics", "selected_at")
