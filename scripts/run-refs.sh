#!/usr/bin/env bash
# Boots headless Chrome and screenshots reference sites.
# Usage: bash scripts/run-refs.sh <outDir> <url> [url ...]
set -euo pipefail

OUT=${1:?usage: run-refs.sh <outDir> <url> [url ...]}
shift

CDP_PORT=${CDP_PORT:-9447}
PROFILE=$(mktemp -d)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

CHROME_PID=""
cleanup() { [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null || true; }
trap cleanup EXIT

"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port="$CDP_PORT" --user-data-dir="$PROFILE" \
  --hide-scrollbars about:blank >/tmp/pawdex-refs-chrome.log 2>&1 &
CHROME_PID=$!
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$CDP_PORT/json/version" >/dev/null 2>&1; then break; fi
  sleep 1
done

CDP_PORT="$CDP_PORT" node scripts/_refs.mjs "$OUT" "$@"
