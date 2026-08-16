#!/usr/bin/env bash
# Boots the built app plus headless Chrome and runs the pricing fit-finder
# behaviour checks: keyboard-only operation, the live announcement, and that
# GSAP is not downloaded before anyone scrolls near it.
#
# Usage: bash scripts/run-plan-fit.sh
set -euo pipefail

PORT=${SCROLL_PORT:-3210}
CDP_PORT=${CDP_PORT:-9445}
PROFILE=$(mktemp -d)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

SERVER_PID=""
CHROME_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null || true
}
trap cleanup EXIT

pnpm exec next start -p "$PORT" >/tmp/pawdex-shots-server.log 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done

"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port="$CDP_PORT" --user-data-dir="$PROFILE" \
  --hide-scrollbars about:blank >/tmp/pawdex-shots-chrome.log 2>&1 &
CHROME_PID=$!
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$CDP_PORT/json/version" >/dev/null 2>&1; then break; fi
  sleep 1
done

SCROLL_ORIGIN="http://localhost:$PORT" CDP_PORT="$CDP_PORT" \
  node scripts/test-plan-fit-cdp.mjs
