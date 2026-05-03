"""hubspot_sync_logs table for CRM push audit trail

Revision ID: 20260426_hubspot_logs
Revises: 20260416_prompt_models_lab
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260426_hubspot_logs"
down_revision: str | None = "20260416_prompt_models_lab"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hubspot_sync_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("subscriber_id", sa.Integer(), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("operation", sa.String(length=32), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("hubspot_contact_id", sa.String(length=64), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["subscriber_id"],
            ["subscribers.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_hubspot_sync_logs_created_at"), "hubspot_sync_logs", ["created_at"])
    op.create_index(op.f("ix_hubspot_sync_logs_email"), "hubspot_sync_logs", ["email"])
    op.create_index(
        op.f("ix_hubspot_sync_logs_subscriber_id"), "hubspot_sync_logs", ["subscriber_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_hubspot_sync_logs_subscriber_id"), table_name="hubspot_sync_logs")
    op.drop_index(op.f("ix_hubspot_sync_logs_email"), table_name="hubspot_sync_logs")
    op.drop_index(op.f("ix_hubspot_sync_logs_created_at"), table_name="hubspot_sync_logs")
    op.drop_table("hubspot_sync_logs")
