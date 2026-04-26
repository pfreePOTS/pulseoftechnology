"""articles.image_url — RSS lead image for newsletter / display

Revision ID: 20260420_article_image_url
Revises: 20260416_topic_selected_at
Create Date: 2026-04-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260420_article_image_url"
down_revision: str | None = "20260416_topic_selected_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("image_url", sa.String(length=2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("articles", "image_url")
