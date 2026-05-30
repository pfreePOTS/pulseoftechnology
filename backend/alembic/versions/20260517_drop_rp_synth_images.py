"""drop legacy recommended_path_synthesis_card_images table

Revision ID: 20260517_drop_rp_synth_images
Revises: 20260516_rp_process_card_lib
Create Date: 2026-05-17 23:00:00.000000+00:00

The per-intake AI-generated banner table is fully superseded by
``recommended_path_process_card_library`` (industry × section). The hot path no longer reads from it
and the matching FastAPI endpoint + model file have been removed in the same change. This
migration drops the unused table and its index.

NOTE: revision id kept ≤32 chars to fit ``alembic_version.version_num`` ``VARCHAR(32)``.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "20260517_drop_rp_synth_images"
down_revision: str | None = "20260516_rp_process_card_lib"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(
        op.f("ix_recommended_path_synthesis_card_images_intake_fingerprint"),
        table_name="recommended_path_synthesis_card_images",
    )
    op.drop_table("recommended_path_synthesis_card_images")


def downgrade() -> None:
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
