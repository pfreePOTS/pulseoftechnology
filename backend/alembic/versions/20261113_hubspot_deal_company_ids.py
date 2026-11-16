"""hubspot_sync_logs deal and company ids for contact-form CRM pushes

Revision ID: 20261113_hs_deal_ids
Revises: 20261108_admin_mfa
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261113_hs_deal_ids"
down_revision: str | None = "20261108_admin_mfa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hubspot_sync_logs",
        sa.Column("hubspot_company_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "hubspot_sync_logs",
        sa.Column("hubspot_deal_id", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("hubspot_sync_logs", "hubspot_deal_id")
    op.drop_column("hubspot_sync_logs", "hubspot_company_id")
