"""add newsletter_briefing json to topics

Revision ID: 20260413_newsletter_briefing
Revises: 8b86fd5cdcc0
Create Date: 2026-04-13 12:00:00.000000+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260413_newsletter_briefing"
down_revision: Union[str, None] = "8b86fd5cdcc0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("topics", sa.Column("newsletter_briefing", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("topics", "newsletter_briefing")
