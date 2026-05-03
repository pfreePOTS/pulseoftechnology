# Database content: export / import

Use this when you need a **clone of whatever is currently in Postgres** (articles, topics, sources, subscribers, etc.) **without rerunning ingestion** or hand-writing seeds.

- **Curated bootstrap only** (RSS list + radar topics definitions): existing modules `backend.seed_sources` and `backend.seed_topics` remain the right tools for empty environments with no historical data.

## Requirements

- **Export** (developer machine): Docker Compose stack with `db` running; Postgres tools run inside the `db` image.
- **Import** (any machine): `postgresql-client` (provides `pg_restore`) matching or newer than Postgres 15 in general.

## 1. Export from local dev (`docker compose`)

From the repo root:

```bash
chmod +x scripts/db/export_data.sh scripts/db/import_data.sh
./scripts/db/export_data.sh
```

Outputs under `scripts/db/artifacts/` (gitignored):

- `pulse_db_data_<timestamp>.dump`
- `pulse_db_data_latest.dump` → symlink to newest

The archive is **`pg_dump --data-only` in custom format**. The table **`alembic_version` is omitted** so the target database keeps whichever revision its own migrations applied.

## 2. Import (e.g. Railway Postgres)

Ensure the target database schema exists at the **same Alembic head** as the source export (usual flow: deploy backend once so `alembic upgrade head` runs).

Then from a shell that can reach Postgres (often your laptop with networking to Railway):

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require'
PG_RESTORE_JOBS=4 ./scripts/db/import_data.sh /path/to/pulse_db_data_....dump
```

Prefer a **fresh** database (migrations ran, tables empty): a second restore can hit primary-key duplicates.

Railway shortcut: Postgres service → Connect → URL as `DATABASE_URL`.

## Troubleshooting

- **FK or duplicate-key errors**: Target already had rows from seeds or partial imports; recreate the Postgres plugin / empty DB or restore to a fresh database.
- **Version skew**: Upgrade Alembic on the target until `alembic current` matches the branch you exported from before importing.
