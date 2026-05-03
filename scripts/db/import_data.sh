#!/usr/bin/env bash
# Restore table data produced by export_data.sh into a Postgres whose schema matches
# the same Alembic head (typically a fresh Railway DB after backend first boot).
#
# Usage:
#   DATABASE_URL='postgresql://...?sslmode=require' ./scripts/db/import_data.sh [path/to.dump]
#
# Env:
#   PG_RESTORE_JOBS  optional parallel restore (e.g. 4); unset = single-threaded.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL to the target Postgres URL (Railway Postgres, local, etc.)." >&2
  exit 1
fi

DUMP="${1:-"$SCRIPT_DIR/artifacts/pulse_db_data_latest.dump"}"

if [[ ! -f "$DUMP" ]]; then
  echo "Dump file not found: $DUMP" >&2
  echo "Run scripts/db/export_data.sh from a machine that has your full dev database." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is required on PATH ( Debian/Ubuntu: postgresql-client package )." >&2
  exit 1
fi

OPTS=(
  --data-only
  --no-owner
  --no-privileges
  --verbose
  -d "$DATABASE_URL"
)

if [[ -n "${PG_RESTORE_JOBS:-}" ]]; then
  OPTS+=(--jobs="$PG_RESTORE_JOBS")
fi

echo "Restoring into target from: $DUMP" >&2
pg_restore "${OPTS[@]}" "$DUMP"

echo "Restore finished. Restart the backend if application-level caches should clear." >&2
