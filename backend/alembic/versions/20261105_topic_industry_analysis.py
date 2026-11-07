"""topics industry analysis run state (claim, last run, attempts, error)

Revision ID: 20261105_industry_analysis
Revises: 20260818_intake_flash
Create Date: 2026-11-05

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261105_industry_analysis"
down_revision: str | None = "20260818_intake_flash"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column("industry_analysis_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "topics",
        sa.Column("industry_analyzed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "topics",
        sa.Column("industry_analysis_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("topics", sa.Column("industry_analysis_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("topics", "industry_analysis_error")
    op.drop_column("topics", "industry_analysis_attempts")
    op.drop_column("topics", "industry_analyzed_at")
    op.drop_column("topics", "industry_analysis_started_at")
