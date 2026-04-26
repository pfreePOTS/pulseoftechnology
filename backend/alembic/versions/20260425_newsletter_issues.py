"""newsletter issue archive for read-online links

Revision ID: 20260425_newsletter_issues
Revises: 20260420_article_image_url
Create Date: 2026-04-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260425_newsletter_issues"
down_revision: str | None = "20260420_article_image_url"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "newsletter_issues",
        sa.Column("token", sa.String(length=96), nullable=False),
        sa.Column("subscriber_email", sa.String(length=512), nullable=False),
        sa.Column("subject", sa.String(length=512), nullable=False),
        sa.Column("html", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("token"),
    )
    op.create_index(
        op.f("ix_newsletter_issues_subscriber_email"),
        "newsletter_issues",
        ["subscriber_email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_newsletter_issues_created_at"),
        "newsletter_issues",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_newsletter_issues_created_at"), table_name="newsletter_issues")
    op.drop_index(op.f("ix_newsletter_issues_subscriber_email"), table_name="newsletter_issues")
    op.drop_table("newsletter_issues")
