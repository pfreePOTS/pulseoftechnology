#!/usr/bin/env bash
# Export table data from the local Compose Postgres (schema comes from Alembic).
#
# Prerequisites: compose stack running with db up (recommended: docker compose up -d db).
#
# Usage:
#   ./scripts/db/export_data.sh
#   ./scripts/db/export_data.sh --without-account-subscriber-data
#
# --without-account-subscriber-data  Omits admin users, subscribers, HubSpot audit rows,
#   survey responses, and per-recipient newsletter_issues (PII). Everything else is
#   included (articles, topics, sources, roles, radar/analysis, etc.).
#
# Writes under scripts/db/artifacts/:
#   pulse_db_data_<timestamp>.dump  OR  pulse_db_data_nousers_<timestamp>.dump
#   pulse_db_data_latest.dump  OR  pulse_db_data_latest_nousers.dump  -> symlink to newest

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=scripts/db/pg_dump_data_excludes.sh
source "$SCRIPT_DIR/pg_dump_data_excludes.sh"

WITHOUT_AS_DATA=0
if [[ "${1:-}" == "--without-account-subscriber-data" ]]; then
  WITHOUT_AS_DATA=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--without-account-subscriber-data]" >&2
  exit 1
fi

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
if [[ "$WITHOUT_AS_DATA" -eq 1 ]]; then
  OUT="$SCRIPT_DIR/artifacts/pulse_db_data_nousers_$STAMP.dump"
  LATEST="$SCRIPT_DIR/artifacts/pulse_db_data_latest_nousers.dump"
else
  OUT="$SCRIPT_DIR/artifacts/pulse_db_data_$STAMP.dump"
  LATEST="$SCRIPT_DIR/artifacts/pulse_db_data_latest.dump"
fi

DUMP_FLAGS=(
  -U "$POSTGRES_USER"
  -d "$POSTGRES_DB"
  --format=custom
  --blobs
  --data-only
  --no-owner
  --no-privileges
)
DUMP_FLAGS+=( "${PG_DUMP_ALWAYS_EXCLUDE[@]}" )
if [[ "$WITHOUT_AS_DATA" -eq 1 ]]; then
  DUMP_FLAGS+=( "${PG_DUMP_NO_ACCOUNT_OR_SUBSCRIBER_DATA[@]}" )
fi

docker compose exec -T db pg_dump "${DUMP_FLAGS[@]}" >"$OUT"

ln -sfn "$(basename "$OUT")" "$LATEST"
echo "Exported data-only archive to:"
echo "  $OUT"
echo "Symlink:"
echo "  $LATEST -> $(readlink "$LATEST")"
