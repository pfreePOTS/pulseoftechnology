"""add industry_positions to topic

Revision ID: 326c3d98703f
Revises: 2731a19728be
Create Date: 2026-03-28 21:10:48.161513+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '326c3d98703f'
down_revision: Union[str, None] = '2731a19728be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('topics', sa.Column('industry_positions', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('topics', 'industry_positions')
