#!/bin/sh
set -eu

cd /app

# Named volume overlays image node_modules — keep it synced when package-lock.json changes.
STAMP=/app/node_modules/.npm-ci-stamp
WANT="$(sha256sum package-lock.json | awk '{ print $1 }')"
if ! [ -f "$STAMP" ] || ! [ "$(cat "$STAMP" 2>/dev/null)" = "$WANT" ]; then
  echo "[frontend-entrypoint] package-lock snapshot changed → npm ci"
  npm ci
  echo "$WANT" >"$STAMP"
fi

exec "$@"
