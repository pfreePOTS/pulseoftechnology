"""add persona_impacts to articles

Revision ID: b8f1c2d3e4a5
Revises: d2ae745e451e
Create Date: 2026-03-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8f1c2d3e4a5"
down_revision: str | None = "d2ae745e451e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("persona_impacts", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("articles", "persona_impacts")
