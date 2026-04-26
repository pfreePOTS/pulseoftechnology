"""prompt template/proposal model selection

Revision ID: 20260416_prompt_models_lab
Revises: 20260425_newsletter_issues
Create Date: 2026-04-16

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260416_prompt_models_lab"
down_revision: str | None = "20260425_newsletter_issues"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_SONNET_AGENTS = {
    "cluster",
    "summarize_node_legacy",
    "summarize_node_persona",
    "summarize_topic",
}


def _default_model(agent_name: str) -> str:
    if agent_name in _SONNET_AGENTS:
        return "claude-sonnet-4-6"
    return "claude-haiku-4-5-20251001"


def upgrade() -> None:
    op.add_column("prompt_templates", sa.Column("model", sa.String(length=128), nullable=True))
    op.add_column("prompt_proposals", sa.Column("model", sa.String(length=128), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, agent_name FROM prompt_templates")).mappings().all()
    for row in rows:
        conn.execute(
            sa.text("UPDATE prompt_templates SET model = :model WHERE id = :id"),
            {"model": _default_model(str(row["agent_name"])), "id": row["id"]},
        )
    proposals = conn.execute(sa.text("SELECT id, agent_name FROM prompt_proposals")).mappings().all()
    for row in proposals:
        conn.execute(
            sa.text("UPDATE prompt_proposals SET model = :model WHERE id = :id"),
            {"model": _default_model(str(row["agent_name"])), "id": row["id"]},
        )


def downgrade() -> None:
    op.drop_column("prompt_proposals", "model")
    op.drop_column("prompt_templates", "model")
