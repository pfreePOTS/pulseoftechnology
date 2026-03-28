"""add adoption_state to topic

Revision ID: 2731a19728be
Revises: 0001
Create Date: 2026-03-28 21:05:38.172896+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2731a19728be'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

adoption_state_enum = sa.Enum(
    'learn_about',
    'get_ahead_of',
    'get_prepared_for',
    'get_your_hands_around',
    'make_the_most_of',
    name='adoptionstate',
)


def upgrade() -> None:
    adoption_state_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'topics',
        sa.Column(
            'adoption_state',
            adoption_state_enum,
            nullable=False,
            server_default='learn_about',
        ),
    )
    # Remove the server default — application code supplies the value going forward
    op.alter_column('topics', 'adoption_state', server_default=None)


def downgrade() -> None:
    op.drop_column('topics', 'adoption_state')
    adoption_state_enum.drop(op.get_bind(), checkfirst=True)
