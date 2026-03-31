"""add suggested_action to signal_recommendations

Revision ID: f3a4b5c6d7e8
Revises: c7d8e9f0a1b2
Create Date: 2026-03-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "signal_recommendations",
        sa.Column(
            "suggested_action",
            sa.String(length=32),
            nullable=False,
            server_default="watch",
        ),
    )
    # Historical rows: treat existing adoption-style suggestions as "radar" intent
    op.execute(
        """
        UPDATE signal_recommendations
        SET suggested_action = 'radar'
        WHERE suggested_state IS NOT NULL AND suggested_state != ''
        """
    )
    op.alter_column("signal_recommendations", "suggested_action", server_default=None)


def downgrade() -> None:
    op.drop_column("signal_recommendations", "suggested_action")
