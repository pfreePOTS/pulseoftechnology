"""recommended path process card library (industry x section banners)

Revision ID: 20260516_rp_process_card_lib
Revises: 20260515_rp_synth_card_images
Create Date: 2026-05-16 18:00:00.000000+00:00

NOTE: revision id kept ≤32 chars to fit ``alembic_version.version_num`` ``VARCHAR(32)``
(see 20260515_rp_synth_card_images for the prior truncation incident).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "20260516_rp_process_card_lib"
down_revision: str | None = "20260515_rp_synth_card_images"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recommended_path_process_card_library",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("industry_slug", sa.String(length=80), nullable=False),
        sa.Column("section_slug", sa.String(length=40), nullable=False),
        sa.Column("industry_label", sa.String(length=120), nullable=False),
        sa.Column("section_label", sa.String(length=40), nullable=False),
        sa.Column("image_blob", sa.LargeBinary(), nullable=False),
        sa.Column("mime_type", sa.String(length=80), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("model", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("timezone('utc', now())"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "industry_slug",
            "section_slug",
            name="uq_rp_process_card_library_industry_section",
        ),
    )
    op.create_index(
        op.f("ix_recommended_path_process_card_library_industry_slug"),
        "recommended_path_process_card_library",
        ["industry_slug"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_recommended_path_process_card_library_industry_slug"),
        table_name="recommended_path_process_card_library",
    )
    op.drop_table("recommended_path_process_card_library")
