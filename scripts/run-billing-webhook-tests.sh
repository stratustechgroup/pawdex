#!/usr/bin/env bash
# Boots the built Next server on :3110 and exercises /api/webhooks/stripe in two
# phases:
#   Phase 1 (fail-closed): no Stripe keys -> the route must 503 in every env.
#   Phase 2 (happy path):  fake STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET ->
#                          run scripts/test-billing-webhook.ts against it.
#
# Requires a prior `pnpm build`. Safe to re-run. LIVE Supabase; the .ts test
# self-cleans its zztest-billing rows.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=3110
BASE="http://localhost:$PORT"
export TEST_BASE_URL="$BASE"

if lsof -ti:$PORT >/dev/null 2>&1; then
  echo "port $PORT already in use - aborting"; exit 2
fi

SERVER_PID=""
stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
    SERVER_PID=""
  fi
}
trap stop_server EXIT

wait_ready() {
  for _ in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/webhooks/stripe" 2>/dev/null)
    if [ -n "$code" ] && [ "$code" != "000" ]; then return 0; fi
    sleep 1
  done
  echo "server did not become ready; log tail:"; tail -20 /tmp/pawdex-billing-test-server.log
  return 1
}

# ── Phase 1: fail-closed 503 with keys absent ─────────────────────────
echo "== Phase 1: fail-closed (no Stripe keys) =="
# Unset any inherited Stripe keys so getStripe()/secret are truly absent.
unset STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
pnpm exec next start -p $PORT >/tmp/pawdex-billing-test-server.log 2>&1 &
SERVER_PID=$!
wait_ready || exit 1
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/webhooks/stripe" \
  -H "content-type: application/json" -d '{}' 2>/dev/null)
if [ "$code" = "503" ]; then
  echo "  PASS  webhook 503s when STRIPE_WEBHOOK_SECRET absent (got $code)"
else
  echo "  FAIL  expected 503 with keys absent, got $code"; stop_server; exit 1
fi
stop_server

# ── Phase 2: happy path with fake keys ────────────────────────────────
echo "== Phase 2: signed-event handling (fake keys) =="
export STRIPE_SECRET_KEY="sk_test_$(openssl rand -hex 12)"
export STRIPE_WEBHOOK_SECRET="whsec_$(openssl rand -base64 24 | tr -d '/+=' )"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_$(openssl rand -hex 12)"
pnpm exec next start -p $PORT >/tmp/pawdex-billing-test-server.log 2>&1 &
SERVER_PID=$!
wait_ready || exit 1
echo "  server ready; running signed-event tests ..."
pnpm dlx tsx scripts/test-billing-webhook.ts
RESULT=$?
stop_server
exit $RESULT
