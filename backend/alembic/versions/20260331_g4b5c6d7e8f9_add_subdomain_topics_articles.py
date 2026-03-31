"""add subdomain to topics and articles; composite unique topic identity

Revision ID: g4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-03-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g4b5c6d7e8f9"
down_revision: Union[str, None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column("subdomain", sa.String(length=120), server_default="", nullable=False),
    )
    op.add_column(
        "articles",
        sa.Column("subdomain", sa.String(length=120), server_default="", nullable=False),
    )
    op.drop_index(op.f("ix_topics_name"), table_name="topics")
    op.create_index(op.f("ix_topics_name"), "topics", ["name"], unique=False)
    op.create_unique_constraint(
        "uq_topics_domain_subdomain_name",
        "topics",
        ["domain", "subdomain", "name"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_topics_domain_subdomain_name", "topics", type_="unique")
    op.drop_index(op.f("ix_topics_name"), table_name="topics")
    op.create_index(op.f("ix_topics_name"), "topics", ["name"], unique=True)
    op.drop_column("articles", "subdomain")
    op.drop_column("topics", "subdomain")
