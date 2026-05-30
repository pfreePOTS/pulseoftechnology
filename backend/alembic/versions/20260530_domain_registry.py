"""domain registry — replace topics.domain string with domains FK

Revision ID: 20260530_domain_registry
Revises: 20260517_drop_rp_synth_images
Create Date: 2026-05-30 12:00:00.000000+00:00
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision: str = "20260530_domain_registry"
down_revision: str | None = "20260517_drop_rp_synth_images"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Seed rows inserted before backfill
_CORE_SEED = [
    ("ai", "Artificial Intelligence", "AI", "Models, agents, LLM safety, ML platforms.", "#7C3AED", 10, "core"),
    ("security", "Cybersecurity", "Security", "Threats, IAM, zero trust, SOC.", "#D5171E", 20, "core"),
    ("cloud", "Cloud Platforms", "Cloud", "Public cloud, multi-cloud, FinOps.", "#38BDF8", 30, "core"),
    ("storage", "Enterprise Storage", "Storage", "NAS, SAN, object storage, backup/DR.", "#0D9488", 40, "core"),
    ("compliance", "Compliance & Governance", "Compliance", "GDPR, HIPAA, DORA, audit.", "#10B981", 50, "core"),
    ("infrastructure", "Infrastructure", "Infrastructure", "Networking, servers, OS, datacenter.", "#F59E0B", 60, "core"),
    ("other", "Other Topics", "Other", "Fallback bucket.", "#6B7280", 999, "hidden"),
]

_LEGACY_MAP = {
    "AI": "ai",
    "Security": "security",
    "Cloud": "cloud",
    "Storage": "storage",
    "Compliance": "compliance",
    "Infrastructure": "infrastructure",
    "Other": "other",
    "Finance": "compliance",
    "Leadership": "ai",
}


def upgrade() -> None:
    now = datetime.now(UTC)

    op.create_table(
        "domains",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("short_label", sa.String(length=40), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=False, server_default="#6B7280"),
        sa.Column("hero_image_url", sa.String(length=512), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="core"),
        sa.Column("merged_into_id", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("promoted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("demoted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('core', 'active', 'candidate', 'deprecated', 'hidden')",
            name="ck_domains_status",
        ),
        sa.ForeignKeyConstraint(["merged_into_id"], ["domains.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_domains_id"), "domains", ["id"], unique=False)
    op.create_index(op.f("ix_domains_slug"), "domains", ["slug"], unique=True)

    op.create_table(
        "domain_health_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("domain_id", sa.Integer(), nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("active_topics", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fresh_articles_30d", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("subscribers_picked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("signal_count_30d", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["domain_id"], ["domains.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "domain_interest_signals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("domain_id", sa.Integer(), nullable=False),
        sa.Column("subscriber_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["domain_id"], ["domains.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscriber_id"], ["subscribers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "domain_suggestions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("subscriber_id", sa.Integer(), nullable=True),
        sa.Column("matched_domain_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["matched_domain_id"], ["domains.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subscriber_id"], ["subscribers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Seed core domains
    domains_table = sa.table(
        "domains",
        sa.column("slug", sa.String),
        sa.column("label", sa.String),
        sa.column("short_label", sa.String),
        sa.column("description", sa.Text),
        sa.column("color", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("status", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        domains_table,
        [
            {
                "slug": slug,
                "label": label,
                "short_label": short,
                "description": desc,
                "color": color,
                "sort_order": sort_order,
                "status": status,
                "created_at": now,
                "updated_at": now,
            }
            for slug, label, short, desc, color, sort_order, status in _CORE_SEED
        ],
    )

    # Add domain_id nullable first
    op.add_column("topics", sa.Column("domain_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_topics_domain_id", "topics", "domains", ["domain_id"], ["id"])

    conn = op.get_bind()

    # Backfill topics.domain_id from legacy string column
    slug_rows = conn.execute(sa.text("SELECT id, slug FROM domains")).fetchall()
    slug_to_id = {row[1]: row[0] for row in slug_rows}
    other_id = slug_to_id["other"]

    topic_rows = conn.execute(sa.text("SELECT id, domain FROM topics")).fetchall()
    for topic_id, domain_str in topic_rows:
        slug = _LEGACY_MAP.get(domain_str or "", "other")
        domain_id = slug_to_id.get(slug, other_id)
        conn.execute(
            sa.text("UPDATE topics SET domain_id = :did WHERE id = :tid"),
            {"did": domain_id, "tid": topic_id},
        )

    # Rewrite subscriber.domains JSON from short labels to slugs (best-effort)
    sub_rows = conn.execute(sa.text("SELECT id, domains FROM subscribers WHERE domains IS NOT NULL")).fetchall()
    for sub_id, domains_json in sub_rows:
        if not isinstance(domains_json, list):
            continue
        new_domains: list[str] = []
        for d in domains_json:
            if not isinstance(d, str):
                continue
            slug = _LEGACY_MAP.get(d) or _LEGACY_MAP.get(d.strip()) or d.lower()
            if slug not in new_domains:
                new_domains.append(slug)
        if new_domains:
            import json

            conn.execute(
                sa.text("UPDATE subscribers SET domains = CAST(:doms AS json) WHERE id = :sid"),
                {"doms": json.dumps(new_domains), "sid": sub_id},
            )

    # Drop old unique constraint and domain string column
    op.drop_constraint("uq_topics_domain_subdomain_name", "topics", type_="unique")
    op.drop_column("topics", "domain")

    op.alter_column("topics", "domain_id", nullable=False)
    op.create_unique_constraint(
        "uq_topics_domain_id_subdomain_name", "topics", ["domain_id", "subdomain", "name"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_topics_domain_id_subdomain_name", "topics", type_="unique")
    op.add_column("topics", sa.Column("domain", sa.String(length=100), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT t.id, d.short_label FROM topics t JOIN domains d ON t.domain_id = d.id"
        )
    ).fetchall()
    for tid, short_label in rows:
        conn.execute(
            sa.text("UPDATE topics SET domain = :sl WHERE id = :tid"),
            {"sl": short_label, "tid": tid},
        )

    op.alter_column("topics", "domain", nullable=False)
    op.create_unique_constraint(
        "uq_topics_domain_subdomain_name", "topics", ["domain", "subdomain", "name"]
    )

    op.drop_constraint("fk_topics_domain_id", "topics", type_="foreignkey")
    op.drop_column("topics", "domain_id")

    op.drop_table("domain_suggestions")
    op.drop_table("domain_interest_signals")
    op.drop_table("domain_health_snapshots")
    op.drop_index(op.f("ix_domains_slug"), table_name="domains")
    op.drop_index(op.f("ix_domains_id"), table_name="domains")
    op.drop_table("domains")
