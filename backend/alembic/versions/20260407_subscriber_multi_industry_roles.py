"""subscriber multi industry and role ids (JSON)

Revision ID: 20260407_sub_multi
Revises: 20260401_survey
Create Date: 2026-04-07

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "20260407_sub_multi"
down_revision: Union[str, None] = "20260401_survey"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("subscribers", sa.Column("industries", sa.JSON(), nullable=True))
    op.add_column("subscribers", sa.Column("role_ids", sa.JSON(), nullable=True))

    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE subscribers
            SET industries = json_build_array(industry)::json
            WHERE industry IS NOT NULL AND trim(industry) <> ''
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE subscribers
            SET role_ids = json_build_array(role_id)::json
            WHERE role_id IS NOT NULL
        """)
    )

    bind = op.get_bind()
    for fk in inspect(bind).get_foreign_keys("subscribers"):
        if fk.get("referred_table") == "roles" and "role_id" in fk.get("constrained_columns", []):
            op.drop_constraint(fk["name"], "subscribers", type_="foreignkey")
            break
    op.drop_index(op.f("ix_subscribers_role_id"), table_name="subscribers")
    op.drop_column("subscribers", "role_id")
    op.drop_column("subscribers", "industry")


def downgrade() -> None:
    op.add_column("subscribers", sa.Column("industry", sa.String(length=100), nullable=True))
    op.add_column("subscribers", sa.Column("role_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_subscribers_role_id"), "subscribers", ["role_id"], unique=False)
    op.create_foreign_key(None, "subscribers", "roles", ["role_id"], ["id"])

    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE subscribers
            SET industry = industries::jsonb->>0
            WHERE industries IS NOT NULL
              AND jsonb_typeof(industries::jsonb) = 'array'
              AND jsonb_array_length(industries::jsonb) > 0
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE subscribers
            SET role_id = (role_ids::jsonb->>0)::integer
            WHERE role_ids IS NOT NULL
              AND jsonb_typeof(role_ids::jsonb) = 'array'
              AND jsonb_array_length(role_ids::jsonb) > 0
        """)
    )

    op.drop_column("subscribers", "role_ids")
    op.drop_column("subscribers", "industries")
