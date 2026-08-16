#!/usr/bin/env bash
# Boots a production build plus headless Chrome, then runs the scroll-system
# verification in scripts/test-marketing-scroll.mjs.
#
# Usage: bash scripts/run-marketing-scroll.sh
# Env:   EXPECTED_SCENES  minimum total .mk-scene count (default set below)
set -euo pipefail

PORT=${SCROLL_PORT:-3210}
CDP_PORT=${CDP_PORT:-9445}
# Raised as scenes land: Task 5 -> 1, Task 6 -> 2, Task 7 -> 3.
EXPECTED_SCENES=${EXPECTED_SCENES:-0}
PROFILE=$(mktemp -d)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

SERVER_PID=""
CHROME_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null || true
}
trap cleanup EXIT

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "building ..."
  pnpm exec next build >/tmp/pawdex-scroll-build.log 2>&1 || {
    echo "build failed"; tail -30 /tmp/pawdex-scroll-build.log; exit 1;
  }
fi

echo "starting server on :$PORT ..."
pnpm exec next start -p "$PORT" >/tmp/pawdex-scroll-server.log 2>&1 &
SERVER_PID=$!
ready=""
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || true)
  if [ "$code" = "200" ]; then ready=1; break; fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "server not ready"; tail -30 /tmp/pawdex-scroll-server.log; exit 1
fi
echo "server ready."

echo "starting headless Chrome on :$CDP_PORT ..."
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port="$CDP_PORT" --user-data-dir="$PROFILE" \
  --hide-scrollbars about:blank >/tmp/pawdex-scroll-chrome.log 2>&1 &
CHROME_PID=$!
cready=""
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$CDP_PORT/json/version" >/dev/null 2>&1; then cready=1; break; fi
  sleep 1
done
if [ -z "$cready" ]; then
  echo "chrome not ready"; tail -30 /tmp/pawdex-scroll-chrome.log; exit 1
fi
echo "chrome ready; verifying scroll system ..."

SCROLL_ORIGIN="http://localhost:$PORT" \
CDP_PORT="$CDP_PORT" \
EXPECTED_SCENES="$EXPECTED_SCENES" \
  node scripts/test-marketing-scroll.mjs
