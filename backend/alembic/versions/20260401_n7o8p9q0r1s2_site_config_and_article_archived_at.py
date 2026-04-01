"""site_config singleton + articles.archived_at

Revision ID: n7o8p9q0r1s2
Revises: 20260401_survey
"""

from datetime import UTC, datetime
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n7o8p9q0r1s2"
down_revision: Union[str, None] = "20260401_survey"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    site_config = sa.table(
        "site_config",
        sa.column("id", sa.Integer),
        sa.column("config", sa.JSON),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        site_config,
        [{"id": 1, "config": {}, "updated_at": datetime.now(UTC)}],
    )
    op.add_column(
        "articles",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_articles_archived_at", "articles", ["archived_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_articles_archived_at", table_name="articles")
    op.drop_column("articles", "archived_at")
    op.drop_table("site_config")
