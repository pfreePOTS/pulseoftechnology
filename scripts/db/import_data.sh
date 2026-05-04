#!/usr/bin/env bash
# Restore table data produced by export_data.sh into a Postgres whose schema matches
# the same Alembic head (typically a fresh Railway DB after backend first boot).
#
# Usage:
#   DATABASE_URL='postgresql://...?sslmode=require' ./scripts/db/import_data.sh [path/to.dump]
#
# Uses host pg_restore when compatible; falls back to Docker (postgres:18-bookworm) when the
# archive needs a newer pg_restore than the host (e.g. pg_dump 18 custom format).
#
# Env:
#   PG_RESTORE_JOBS  optional parallel restore (e.g. 4); unset = single-threaded.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prefer DATABASE_PUBLIC_URL so host-side tools work (internal DATABASE_URL often *.railway.internal).
TARGET_URL="${DATABASE_PUBLIC_URL:-${DATABASE_URL:-}}"
if [[ -z "$TARGET_URL" ]]; then
  echo "Set DATABASE_PUBLIC_URL or DATABASE_URL to the target Postgres URL." >&2
  exit 1
fi

DUMP="${1:-"$SCRIPT_DIR/artifacts/pulse_db_data_latest.dump"}"

if [[ ! -f "$DUMP" ]]; then
  echo "Dump file not found: $DUMP" >&2
  echo "Run scripts/db/export_data.sh or export_data_from_url.sh first." >&2
  exit 1
fi

DUMP_DIR="$(cd "$(dirname "$DUMP")" && pwd)"
DUMP_BASE="$(basename "$DUMP")"

OPTS=(
  --data-only
  --no-owner
  --no-privileges
  --verbose
  -d "$TARGET_URL"
)

if [[ -n "${PG_RESTORE_JOBS:-}" ]]; then
  OPTS+=(--jobs="$PG_RESTORE_JOBS")
fi

ERR="$(mktemp)"
cleanup() { rm -f "$ERR"; }
trap cleanup EXIT

restore_via_docker() {
  local img="${PG_RESTORE_DOCKER_IMAGE:-postgres:18-bookworm}"
  echo "Using pg_restore from Docker image: $img" >&2
  docker run --rm \
    -v "$DUMP_DIR:/dumps:ro" \
    "$img" \
    pg_restore "${OPTS[@]}" "/dumps/$DUMP_BASE"
}

echo "Restoring into target from: $DUMP" >&2

if command -v pg_restore >/dev/null 2>&1; then
  if pg_restore "${OPTS[@]}" "$DUMP_DIR/$DUMP_BASE" 2>"$ERR"; then
    :
  else
    if grep -q 'unsupported version' "$ERR" 2>/dev/null && command -v docker >/dev/null 2>&1; then
      restore_via_docker
    else
      cat "$ERR" >&2
      exit 1
    fi
  fi
elif command -v docker >/dev/null 2>&1; then
  restore_via_docker
else
  echo "Install postgresql-client (pg_restore) or Docker." >&2
  exit 1
fi

echo "Restore finished. Restart the backend if application-level caches should clear." >&2
