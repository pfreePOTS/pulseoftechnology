"""admin_mfa_challenges for email OTP login

Revision ID: 20261108_admin_mfa
Revises: 20261105_industry_analysis
Create Date: 2026-11-08

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261108_admin_mfa"
down_revision: str | None = "20261105_industry_analysis"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admin_mfa_challenges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("challenge_id", sa.String(length=36), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["admin_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("challenge_id"),
    )
    op.create_index(op.f("ix_admin_mfa_challenges_id"), "admin_mfa_challenges", ["id"], unique=False)
    op.create_index(
        op.f("ix_admin_mfa_challenges_user_id"), "admin_mfa_challenges", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_admin_mfa_challenges_challenge_id"),
        "admin_mfa_challenges",
        ["challenge_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_mfa_challenges_challenge_id"), table_name="admin_mfa_challenges")
    op.drop_index(op.f("ix_admin_mfa_challenges_user_id"), table_name="admin_mfa_challenges")
    op.drop_index(op.f("ix_admin_mfa_challenges_id"), table_name="admin_mfa_challenges")
    op.drop_table("admin_mfa_challenges")
