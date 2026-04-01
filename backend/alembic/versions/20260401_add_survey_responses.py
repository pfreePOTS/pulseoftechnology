"""add survey_responses table

Revision ID: 20260401_survey
Revises: 20260401_image_url
Create Date: 2026-04-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260401_survey"
down_revision: Union[str, None] = "20260401_image_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "survey_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subscriber_email", sa.String(length=512), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("newsletter_date", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_survey_responses_subscriber_email"),
        "survey_responses",
        ["subscriber_email"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_survey_responses_subscriber_email"), table_name="survey_responses")
    op.drop_table("survey_responses")
