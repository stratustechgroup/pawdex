#!/usr/bin/env bash
# Boots the built Next server on :3800 + a headless Chrome on a debug port with
# a throwaway profile, runs scripts/test-billing-e2e.mjs (captures /pricing and
# /settings/billing screenshots, self-cleans its ZZTEST user), then tears both
# down. Requires a prior `pnpm build`. Safe to re-run.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=3800
CDP_PORT=9334
export E2E_ORIGIN="http://localhost:$PORT"
export CDP_PORT
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$(mktemp -d)"

if lsof -ti:$PORT >/dev/null 2>&1; then echo "port $PORT in use - aborting"; exit 2; fi
if lsof -ti:$CDP_PORT >/dev/null 2>&1; then echo "port $CDP_PORT in use - aborting"; exit 2; fi

SERVER_PID=""
CHROME_PID=""
cleanup() {
  [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  wait 2>/dev/null
  rm -rf "$PROFILE"
}
trap cleanup EXIT

echo "starting server on :$PORT ..."
pnpm exec next start -p $PORT >/tmp/pawdex-billing-e2e-server.log 2>&1 &
SERVER_PID=$!
ready=""
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$E2E_ORIGIN/pricing" 2>/dev/null)
  if [ "$code" = "200" ]; then ready=1; break; fi
  sleep 1
done
if [ -z "$ready" ]; then echo "server not ready"; tail -20 /tmp/pawdex-billing-e2e-server.log; exit 1; fi
echo "server ready."

echo "starting headless Chrome on :$CDP_PORT ..."
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port=$CDP_PORT --user-data-dir="$PROFILE" \
  --hide-scrollbars about:blank >/tmp/pawdex-billing-e2e-chrome.log 2>&1 &
CHROME_PID=$!
cready=""
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$CDP_PORT/json/version" >/dev/null 2>&1; then cready=1; break; fi
  sleep 1
done
if [ -z "$cready" ]; then echo "chrome not ready"; tail -20 /tmp/pawdex-billing-e2e-chrome.log; exit 1; fi
echo "chrome ready; running E2E ..."

node scripts/test-billing-e2e.mjs
exit $?
