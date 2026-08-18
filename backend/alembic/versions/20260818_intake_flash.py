"""Point hourly intake Prompt Lab models at DeepSeek Flash.

Revision ID: 20260818_intake_flash
Revises: 20260530_domain_registry
Create Date: 2026-08-18

Active ``prompt_templates.model`` values override code defaults. Staging/Dev
rows were stored as ``deepseek-v4-pro``; without this update, intake would
keep paying Pro rates after the Flash default change.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260818_intake_flash"
down_revision: str | None = "20260530_domain_registry"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INTAKE_AGENTS = (
    "gate",
    "classify",
    "score",
    "cluster",
    "summarize_node_legacy",
    "summarize_node_persona",
)


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE prompt_templates SET model = :model "
            "WHERE is_active IS true AND agent_name IN :names"
        ).bindparams(sa.bindparam("names", expanding=True)),
        {"model": "deepseek-v4-flash", "names": list(_INTAKE_AGENTS)},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE prompt_templates SET model = :model "
            "WHERE is_active IS true AND agent_name IN :names"
        ).bindparams(sa.bindparam("names", expanding=True)),
        {"model": "deepseek-v4-pro", "names": list(_INTAKE_AGENTS)},
    )
