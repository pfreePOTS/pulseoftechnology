"""agent_runs: article link, latency, tokens, model

Revision ID: 20260415_agent_run_metrics
Revises: 20260414_optimizer
Create Date: 2026-04-15

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260415_agent_run_metrics"
down_revision: str | None = "20260414_optimizer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("agent_runs", sa.Column("article_id", sa.Integer(), nullable=True))
    op.add_column("agent_runs", sa.Column("latency_ms", sa.Integer(), nullable=True))
    op.add_column("agent_runs", sa.Column("tokens", sa.Integer(), nullable=True))
    op.add_column("agent_runs", sa.Column("model", sa.String(length=128), nullable=True))
    op.create_index("ix_agent_runs_article_id", "agent_runs", ["article_id"], unique=False)
    op.create_foreign_key(
        "fk_agent_runs_article_id_articles",
        "agent_runs",
        "articles",
        ["article_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_agent_runs_article_id_articles", "agent_runs", type_="foreignkey")
    op.drop_index("ix_agent_runs_article_id", table_name="agent_runs")
    op.drop_column("agent_runs", "model")
    op.drop_column("agent_runs", "tokens")
    op.drop_column("agent_runs", "latency_ms")
    op.drop_column("agent_runs", "article_id")
