# Database content: export / import

Use this when you need a **clone of whatever is currently in Postgres** (articles, topics, sources, roles, radar/analysis, etc.) **without rerunning ingestion** or hand-writing seeds. You can export **with or without** console **admin** and **subscriber**-related rows (see **section 1** below).

**Which database is which**

- **`pg_dump` / `export_data_from_url.sh`:** **reads** from the source URL only (it does not modify that database).
- **`pg_restore` / `import_data.sh`:** **writes** to whichever URL you pass (this is the only step that changes the target).

To **fill Staging**, run import with **Staging’s** connection string (for example `railway run -e staging -s "Backend - Staging" -- ./scripts/db/import_data.sh …` so `DATABASE_PUBLIC_URL` is Staging’s). Do **not** use that import command against production unless you intend to overwrite production data.

Pick the **export** source as whichever Postgres **already has the rows** you want (verify with `psql … -c '\dt public.*'`). In this repo’s Railway layout, the Staging plugin often holds the real app data while another environment’s Postgres plugin may be empty — exporting from an empty DB yields a tiny dump and restores nothing useful.

- **Curated bootstrap only** (RSS list + radar topics + standard roles):

  ```bash
  docker compose exec backend python -m backend.seed_local_dev
  ```

  Equivalent to running `backend.seed_sources`, `backend.seed_topics`, and `backend.seed_roles` individually.

- **Role profiles only** (CEO/CFO/… tags):

  - *Canonical in-repo personas* (no Dev DB needed; safe to rerun on Staging):

    ```bash
    docker compose exec backend python -m backend.seed_roles
    ```

  - *Copy rows from Dev Postgres to Staging* (upsert by `name`; use Railway “Connect” strings):

    ```bash
    SOURCE_DATABASE_URL='postgresql://...' TARGET_DATABASE_URL='postgresql://...' \\
    docker compose exec -e SOURCE_DATABASE_URL -e TARGET_DATABASE_URL backend \\
      python -m backend.copy_roles_between
    ```

- **Content Library** (`content_items` — first-party newsletter assets):

  - *Copy from Dev to Staging* (upsert by id / UUID so links stay stable):

    ```bash
    SOURCE_DATABASE_URL='postgresql://...' TARGET_DATABASE_URL='postgresql://...' \\
    docker compose exec -e SOURCE_DATABASE_URL -e TARGET_DATABASE_URL backend \\
      python -m backend.copy_content_items_between
    ```

- **Roles + Content Library in one command**

  ```bash
  SOURCE_DATABASE_URL='postgresql://...dev...' TARGET_DATABASE_URL='postgresql://...staging...' \\
  docker compose exec -e SOURCE_DATABASE_URL -e TARGET_DATABASE_URL backend \\
    python -m backend.sync_newsletter_cms_between
  ```

## Requirements

- **Export (Compose)**: Docker Compose stack with `db` running; `pg_dump` runs inside the `db` image.
- **Export (Railway / any URL)**: Host `pg_dump` from **`postgresql-client`** (same major as Postgres 15+).
- **Import** (any machine): `postgresql-client` (provides `pg_restore`) matching or newer than Postgres 15 in general.

## 1. Export

### 1a. From local dev (`docker compose`)

From the repo root:

```bash
chmod +x scripts/db/export_data.sh scripts/db/export_data_from_url.sh scripts/db/import_data.sh
./scripts/db/export_data.sh
```

**Dev → Staging without admin/subscriber PII** (articles, topics, sources, roles, content library, prompts, signals, classification feedback, agent runs, etc. — same as Dev, but no console users or marketing cohort):

```bash
./scripts/db/export_data.sh --without-account-subscriber-data
```

### 1b. From a remote Postgres URL (e.g. Railway Dev)

On a machine with `pg_dump` on `PATH`:

```bash
chmod +x scripts/db/export_data_from_url.sh
SOURCE_DATABASE_URL='postgresql://USER:PASS@HOST:PORT/DB?sslmode=require' ./scripts/db/export_data_from_url.sh --without-account-subscriber-data
```

Omit `--without-account-subscriber-data` only if you intend to copy **admin_users**, **subscribers**, and related tables too.

### Outputs (`scripts/db/artifacts/`, gitignored)

| Mode | Files |
|------|--------|
| Full data | `pulse_db_data_<timestamp>.dump`, symlink `pulse_db_data_latest.dump` |
| Without account/subscriber data | `pulse_db_data_nousers_<timestamp>.dump`, symlink `pulse_db_data_latest_nousers.dump` |

The archive is **`pg_dump --data-only` in custom format**. The table **`alembic_version` is always omitted** so the target database keeps whichever revision its own migrations applied.

**`--without-account-subscriber-data` excludes:** `admin_users`, `subscribers`, `hubspot_sync_logs` (FK to subscribers), `survey_responses`, `newsletter_issues` (per-recipient email + HTML). The list lives in `scripts/db/pg_dump_data_excludes.sh` — update it if you add new PII tables.

## 2. Import (e.g. Railway **Staging**)

Ensure the target database schema exists at the **same Alembic head** as the source export (usual flow: deploy backend once so `alembic upgrade head` runs).

### Generic (explicit URL)

From a shell that can reach Postgres:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require'
PG_RESTORE_JOBS=4 ./scripts/db/import_data.sh /path/to/pulse_db_data_....dump
```

Prefer **`DATABASE_PUBLIC_URL`** when the host cannot resolve `*.railway.internal` (see `import_data.sh`).

### Railway: restore **into Staging** (recommended)

Link the CLI, then run import with variables from the **Staging backend** service so the target is **Staging Postgres**, not production:

```bash
cd /path/to/pulseoftechnology
railway run -e staging -s "Backend - Staging" -- \
  ./scripts/db/import_data.sh scripts/db/artifacts/pulse_db_data_latest_nousers.dump
```

(`pg_dump` is still **read-only** on whichever database you exported from.)

Prefer a **fresh** target database (migrations ran, tables empty) when possible; a second restore can hit primary-key duplicates.

If you restore a **`nousers`** dump onto a database that **already had** subscribers or admin rows, those tables are **not cleared** by `pg_restore` (they were not in the dump). Truncate them first if you need Staging to have **no** copied-over accounts or subscribers from before the restore.

## Troubleshooting

- **FK or duplicate-key errors**: Target already had rows from seeds or partial imports; recreate the Postgres plugin / empty DB or restore to a fresh database.
- **`nousers` restore but old subscribers still show**: Excluded tables are not overwritten; truncate `subscribers`, `admin_users`, and related tables, or restore into a new database.
- **Version skew**: Upgrade Alembic on the target until `alembic current` matches the branch you exported from before importing.
