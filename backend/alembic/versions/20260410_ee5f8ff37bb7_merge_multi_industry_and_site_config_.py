"""merge multi-industry and site-config heads

Revision ID: ee5f8ff37bb7
Revises: n7o8p9q0r1s2, 20260407_sub_multi
Create Date: 2026-04-10 21:07:03.333499+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ee5f8ff37bb7'
down_revision: Union[str, None] = ('n7o8p9q0r1s2', '20260407_sub_multi')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
