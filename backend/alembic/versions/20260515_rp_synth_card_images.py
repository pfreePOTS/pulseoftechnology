"""recommended path synthesis card images (stored AI banners)

Revision ID: 20260515_rp_synth_card_images
Revises: 20260429_article_review_queue
Create Date: 2026-05-15 12:00:00.000000+00:00

NOTE: Earlier draft used ``20260515_rp_synthesis_card_images`` (33 chars) which exceeded the
``alembic_version.version_num`` ``VARCHAR(32)`` cap and rolled back inside the upgrade
transaction (``StringDataRightTruncation``). Shortened to fit. See terminals/1.txt for the
original failure trace.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "20260515_rp_synth_card_images"
down_revision: str | None = "20260429_article_review_queue"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recommended_path_synthesis_card_images",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("intake_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("card_index", sa.Integer(), nullable=False),
        sa.Column("content_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("image_blob", sa.LargeBinary(), nullable=False),
        sa.Column("mime_type", sa.String(length=80), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "intake_fingerprint",
            "card_index",
            name="uq_rp_synthesis_card_image_intake_idx",
        ),
    )
    op.create_index(
        op.f("ix_recommended_path_synthesis_card_images_intake_fingerprint"),
        "recommended_path_synthesis_card_images",
        ["intake_fingerprint"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_recommended_path_synthesis_card_images_intake_fingerprint"),
        table_name="recommended_path_synthesis_card_images",
    )
    op.drop_table("recommended_path_synthesis_card_images")
