"""article review queue and classification feedback

Revision ID: 20260429_article_review_queue
Revises: 20260427_failure_detail
Create Date: 2026-04-29 21:05:00.000000+00:00

"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260429_article_review_queue"
down_revision: str | None = "20260427_failure_detail"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE articlestatus ADD VALUE IF NOT EXISTS 'review'")
    op.add_column("articles", sa.Column("review_reason", sa.Text(), nullable=True))
    op.add_column("articles", sa.Column("review_notes", sa.Text(), nullable=True))
    op.add_column("articles", sa.Column("ai_confidence", sa.Float(), nullable=True))
    op.add_column("articles", sa.Column("ai_output", sa.JSON(), nullable=True))
    op.add_column(
        "articles",
        sa.Column("review_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_table(
        "classification_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("article_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("article_title", sa.String(length=1024), nullable=False),
        sa.Column("content_excerpt", sa.Text(), nullable=True),
        sa.Column("original_domain", sa.String(length=100), nullable=True),
        sa.Column("original_subdomain", sa.String(length=120), nullable=True),
        sa.Column("original_topic_name", sa.String(length=255), nullable=True),
        sa.Column("corrected_domain", sa.String(length=100), nullable=True),
        sa.Column("corrected_subdomain", sa.String(length=120), nullable=True),
        sa.Column("corrected_topic_name", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_classification_feedback_article_id"),
        "classification_feedback",
        ["article_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_feedback_id"),
        "classification_feedback",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_classification_feedback_id"), table_name="classification_feedback")
    op.drop_index(op.f("ix_classification_feedback_article_id"), table_name="classification_feedback")
    op.drop_table("classification_feedback")
    op.drop_column("articles", "review_attempts")
    op.drop_column("articles", "ai_output")
    op.drop_column("articles", "ai_confidence")
    op.drop_column("articles", "review_notes")
    op.drop_column("articles", "review_reason")
    op.execute("UPDATE articles SET status = 'retry' WHERE status = 'review'")
