#!/usr/bin/env bash
# Data-only pg_dump from any reachable Postgres URL (e.g. Railway public URL).
# Same semantics as export_data.sh; uses host pg_dump, or Docker when the server is newer
# (e.g. Postgres 18 on Railway vs Ubuntu pg_dump 16).
#
# Usage:
#   SOURCE_DATABASE_URL='postgresql://...?sslmode=require' ./scripts/db/export_data_from_url.sh
#   SOURCE_DATABASE_URL='...' ./scripts/db/export_data_from_url.sh --without-account-subscriber-data
#
# Optional: PG_DUMP_DOCKER_IMAGE=postgres:18-bookworm (used on version mismatch or if pg_dump missing).
#
# Writes under scripts/db/artifacts/ (same naming as export_data.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/db/pg_dump_data_excludes.sh
source "$SCRIPT_DIR/pg_dump_data_excludes.sh"

WITHOUT_AS_DATA=0
if [[ "${1:-}" == "--without-account-subscriber-data" ]]; then
  WITHOUT_AS_DATA=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: SOURCE_DATABASE_URL='postgresql://...' $0 [--without-account-subscriber-data]" >&2
  exit 1
fi

# Prefer public URL so host-side tools can reach Railway. Then DATABASE_URL.
SRC="${SOURCE_DATABASE_URL:-${DATABASE_PUBLIC_URL:-${DATABASE_URL:-}}}"
if [[ -z "$SRC" ]]; then
  echo "Set SOURCE_DATABASE_URL (or DATABASE_PUBLIC_URL / DATABASE_URL) to the source Postgres connection string." >&2
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

ERR="$(mktemp)"
cleanup() { rm -f "$ERR"; }
trap cleanup EXIT

dump_via_docker() {
  local img="${PG_DUMP_DOCKER_IMAGE:-postgres:18-bookworm}"
  local base
  base="$(basename "$OUT")"
  echo "Using pg_dump from Docker image: $img" >&2
  docker run --rm \
    -v "$SCRIPT_DIR/artifacts:/artifacts" \
    "$img" \
    pg_dump --dbname="$SRC" "${DUMP_FLAGS[@]}" -f "/artifacts/$base"
}

if command -v pg_dump >/dev/null 2>&1; then
  if pg_dump --dbname="$SRC" "${DUMP_FLAGS[@]}" -f "$OUT" 2>"$ERR"; then
    :
  else
    if grep -q 'server version mismatch' "$ERR" 2>/dev/null && command -v docker >/dev/null 2>&1; then
      dump_via_docker
    else
      cat "$ERR" >&2
      exit 1
    fi
  fi
elif command -v docker >/dev/null 2>&1; then
  dump_via_docker
else
  echo "Install postgresql-client (pg_dump) or Docker to run pg_dump." >&2
  exit 1
fi

ln -sfn "$(basename "$OUT")" "$LATEST"
echo "Exported data-only archive to:"
echo "  $OUT"
echo "Symlink:"
echo "  $LATEST -> $(readlink "$LATEST")"
