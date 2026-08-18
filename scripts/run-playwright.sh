#!/usr/bin/env bash
# Playwright sweep: four viewports, both colour schemes, screenshots written to
# SHOT_DIR. Boots its own production server.
#
# Usage: bash scripts/run-playwright.sh [shotDir]
set -euo pipefail

PORT=${SCROLL_PORT:-3211}
export SHOT_DIR=${1:-/tmp/pawdex-pw}
export SCROLL_ORIGIN="http://localhost:$PORT"
mkdir -p "$SHOT_DIR"

SERVER_PID=""
cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

pnpm exec next start -p "$PORT" >/tmp/pawdex-pw-server.log 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SCROLL_ORIGIN/" 2>/dev/null || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done

pnpm exec playwright test scripts/marketing.spec.ts \
  --reporter=list --workers=4
