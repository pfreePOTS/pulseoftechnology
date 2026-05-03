#!/usr/bin/env bash
# Export ALL table data from the local Compose Postgres (schema comes from Alembic).
#
# Prerequisites: compose stack running with db up (recommended: docker compose up -d db).
#
# Writes:
#   scripts/db/artifacts/pulse_db_data_<timestamp>.dump
#   scripts/db/artifacts/pulse_db_data_latest.dump -> symlink to newest file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-pulse_user}"
POSTGRES_DB="${POSTGRES_DB:-pulse_db}"

cd "$ROOT"
if ! docker compose ps db --status running --quiet 2>/dev/null | grep -q .; then
  echo "The db container is not running. From the repo root run: docker compose up -d db" >&2
  exit 1
fi

mkdir -p "$SCRIPT_DIR/artifacts"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$SCRIPT_DIR/artifacts/pulse_db_data_$STAMP.dump"
LATEST="$SCRIPT_DIR/artifacts/pulse_db_data_latest.dump"

# Exclude alembic_version so the target keeps revision from its own migrations.
docker compose exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --blobs \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-table=alembic_version \
  >"$OUT"

ln -sfn "$(basename "$OUT")" "$LATEST"
echo "Exported data-only archive to:"
echo "  $OUT"
echo "Symlink:"
echo "  $LATEST -> $(readlink "$LATEST")"
