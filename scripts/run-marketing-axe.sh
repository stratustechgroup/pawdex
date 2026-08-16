#!/usr/bin/env bash
# Accessibility pass over the marketing surface, using the axe runner that
# already exists in this repo. Run after any structural change to the pages.
#
# Usage: bash scripts/run-marketing-axe.sh
set -euo pipefail

PORT=${SCROLL_PORT:-3210}
CDP_PORT=${CDP_PORT:-9446}
PROFILE=$(mktemp -d)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

SERVER_PID=""
CHROME_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null || true
}
trap cleanup EXIT

pnpm exec next start -p "$PORT" >/tmp/pawdex-axe-server.log 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done

"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port="$CDP_PORT" --user-data-dir="$PROFILE" \
  --hide-scrollbars about:blank >/tmp/pawdex-axe-chrome.log 2>&1 &
CHROME_PID=$!
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$CDP_PORT/json/version" >/dev/null 2>&1; then break; fi
  sleep 1
done

node scripts/launch-axe.mjs "$CDP_PORT" \
  "http://localhost:$PORT/" \
  "http://localhost:$PORT/pricing" \
  "http://localhost:$PORT/about" \
  "http://localhost:$PORT/architecture" \
  "http://localhost:$PORT/privacy"
