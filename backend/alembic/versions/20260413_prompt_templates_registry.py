"""prompt_templates registry for dynamic AI system prompts

Revision ID: 20260413_prompt_templates
Revises: 20260413_admin_users
Create Date: 2026-04-13

"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260413_prompt_templates"
down_revision: str | None = "20260413_admin_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("agent_name", sa.String(length=128), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_prompt_templates_agent_name", "prompt_templates", ["agent_name"], unique=False
    )
    op.create_index(
        "ix_prompt_templates_is_active", "prompt_templates", ["is_active"], unique=False
    )

    from backend.services.ai_service import PROMPT_TEMPLATE_SEED_V1

    conn = op.get_bind()
    now = datetime.now(UTC)
    insert_stmt = sa.text(
        """
        INSERT INTO prompt_templates (agent_name, version, system_prompt, is_active, created_at)
        VALUES (:agent_name, :version, :system_prompt, :is_active, :created_at)
        """
    )
    for row in PROMPT_TEMPLATE_SEED_V1:
        conn.execute(
            insert_stmt,
            {
                "agent_name": row["agent_name"],
                "version": row["version"],
                "system_prompt": row["system_prompt"],
                "is_active": row["is_active"],
                "created_at": now,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_prompt_templates_is_active", table_name="prompt_templates")
    op.drop_index("ix_prompt_templates_agent_name", table_name="prompt_templates")
    op.drop_table("prompt_templates")
