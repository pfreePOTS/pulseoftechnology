"""Initial schema: sources, articles, topics, subscribers

Revision ID: 0001
Revises:
Create Date: 2026-03-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum types (PostgreSQL)
sourcetype_enum = sa.Enum("rss", "api", name="sourcetype")
articlestatus_enum = sa.Enum("raw", "processed", "published", name="articlestatus")
topicstatus_enum = sa.Enum("pending", "approved", name="topicstatus")


def upgrade() -> None:
    # -- sources ----------------------------------------------------------------
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column(
            "type",
            sourcetype_enum,
            nullable=False,
            server_default="rss",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )
    op.create_index("ix_sources_id", "sources", ["id"])

    # -- topics -----------------------------------------------------------------
    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(100), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "urgency_score",
            sa.Float(),
            nullable=False,
            server_default="0.0",
        ),
        sa.Column(
            "status",
            topicstatus_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_topics_id", "topics", ["id"])
    op.create_index("ix_topics_name", "topics", ["name"])
    op.create_index("ix_topics_status", "topics", ["status"])

    # -- articles ---------------------------------------------------------------
    op.create_table(
        "articles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(1024), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "status",
            articlestatus_enum,
            nullable=False,
            server_default="raw",
        ),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )
    op.create_index("ix_articles_id", "articles", ["id"])
    op.create_index("ix_articles_source_id", "articles", ["source_id"])
    op.create_index("ix_articles_status", "articles", ["status"])
    op.create_index("ix_articles_topic_id", "articles", ["topic_id"])
    op.create_index("ix_articles_url", "articles", ["url"])

    # -- subscribers ------------------------------------------------------------
    op.create_table(
        "subscribers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("domains", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_subscribers_id", "subscribers", ["id"])
    op.create_index("ix_subscribers_email", "subscribers", ["email"])


def downgrade() -> None:
    op.drop_table("subscribers")
    op.drop_index("ix_articles_url", "articles")
    op.drop_index("ix_articles_topic_id", "articles")
    op.drop_index("ix_articles_status", "articles")
    op.drop_index("ix_articles_source_id", "articles")
    op.drop_index("ix_articles_id", "articles")
    op.drop_table("articles")
    op.drop_index("ix_topics_status", "topics")
    op.drop_index("ix_topics_name", "topics")
    op.drop_index("ix_topics_id", "topics")
    op.drop_table("topics")
    op.drop_index("ix_sources_id", "sources")
    op.drop_table("sources")
    topicstatus_enum.drop(op.get_bind())
    articlestatus_enum.drop(op.get_bind())
    sourcetype_enum.drop(op.get_bind())
