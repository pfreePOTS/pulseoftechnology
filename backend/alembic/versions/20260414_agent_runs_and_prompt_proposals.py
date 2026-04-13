"""agent_runs telemetry and prompt_proposals optimizer

Revision ID: 20260414_optimizer
Revises: 20260413_prompt_templates
Create Date: 2026-04-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260414_optimizer"
down_revision: str | None = "20260413_prompt_templates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("agent_name", sa.String(length=128), nullable=False),
        sa.Column("is_success", sa.Boolean(), nullable=False),
        sa.Column("fallback_used", sa.Boolean(), nullable=False),
        sa.Column("context_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_runs_agent_name", "agent_runs", ["agent_name"], unique=False)
    op.create_index("ix_agent_runs_created_at", "agent_runs", ["created_at"], unique=False)

    op.create_table(
        "prompt_proposals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("agent_name", sa.String(length=128), nullable=False),
        sa.Column("base_version", sa.String(length=32), nullable=False),
        sa.Column("proposed_system_prompt", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False, server_default=""),
        sa.Column("test_improvement_score", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_prompt_proposals_agent_name", "prompt_proposals", ["agent_name"], unique=False
    )
    op.create_index("ix_prompt_proposals_status", "prompt_proposals", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_prompt_proposals_status", table_name="prompt_proposals")
    op.drop_index("ix_prompt_proposals_agent_name", table_name="prompt_proposals")
    op.drop_table("prompt_proposals")
    op.drop_index("ix_agent_runs_created_at", table_name="agent_runs")
    op.drop_index("ix_agent_runs_agent_name", table_name="agent_runs")
    op.drop_table("agent_runs")
