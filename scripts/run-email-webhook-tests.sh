#!/usr/bin/env bash
# Boots the built Next server on :3100 with test webhook secrets and a blanked
# OpenRouter key (so inbound extraction fails fast instead of spending tokens),
# runs scripts/test-email-webhooks.ts against it, then tears the server down.
#
# Requires a prior `pnpm build`. Safe to re-run.
set -uo pipefail
cd "$(dirname "$0")/.."

export RESEND_WEBHOOK_SECRET="whsec_$(openssl rand -base64 24)"
export RESEND_INBOUND_SECRET="whsec_$(openssl rand -base64 24)"
export OPENROUTER_API_KEY=""          # neuter extraction during the inbound test
export TEST_BASE_URL="http://localhost:3100"

PORT=3100
if lsof -ti:$PORT >/dev/null 2>&1; then
  echo "port $PORT already in use - aborting"; exit 2
fi

echo "starting server on :$PORT ..."
pnpm exec next start -p $PORT >/tmp/pawdex-email-test-server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  echo "stopping server ($SERVER_PID) ..."
  kill "$SERVER_PID" 2>/dev/null
  wait "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT

# Wait for readiness (any HTTP response from the webhook route).
ready=""
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TEST_BASE_URL/api/webhooks/resend" 2>/dev/null)
  if [ -n "$code" ] && [ "$code" != "000" ]; then ready=1; break; fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "server did not become ready; log tail:"; tail -20 /tmp/pawdex-email-test-server.log; exit 1
fi
echo "server ready; running tests ..."

pnpm dlx tsx scripts/test-email-webhooks.ts
exit $?
