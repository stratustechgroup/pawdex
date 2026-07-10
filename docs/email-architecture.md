# Email architecture: verification and go-live

Owner: email-infrastructure team (Task #11). Last verified 2026-07-10 against the
live Supabase project `ozexfuawzqjcjgdhgrqx` and a production build served
locally on port 3100.

Scope: every path that sends or receives email, plus the pg_cron chain that
drives them. `RESEND_API_KEY` is intentionally empty in the environment, so no
real mail sends. The goal here is that the architecture is correct and the
moment a Resend key lands, every path works. All fixes below are in this team's
files only.

## How this was verified

Two behavioral test scripts plus a read-only database inspection. No test
framework: each script exits nonzero on any failed assertion.

- `scripts/test-email-unsub-token.ts` (pure crypto, no server): proves the
  reminder unsubscribe token round-trips between the Deno edge function and the
  Next verifier, and that the token is safe to sit in a URL path. Run with
  `pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-email-unsub-token.ts`.
- `scripts/test-email-webhooks.ts` driven by `scripts/run-email-webhook-tests.sh`:
  boots the built server on :3100 with test signing secrets and a blanked
  OpenRouter key, exercises both webhooks over real HTTP, asserts on the
  resulting database rows, and tears down every test row. Run with
  `bash scripts/run-email-webhook-tests.sh`.
- Cron chain: read-only queries against `cron.job` and `vault.secrets` (names
  only, never secret values).

Test data safety: every row the webhook script creates belongs to a household
named `ZZTEST email-webhooks` and its children, all deleted in a `finally`
block in reverse foreign-key order. Re-running the script is safe.

## Verification matrix

| # | Path | How verified | Result |
|---|------|--------------|--------|
| 1 | Reminders edge function (`supabase/functions/reminders-cron/index.ts`) | Code review of recipient resolution, per-email try/catch isolation, and the `uniq_reminders_idempotency (entity_type, entity_id, lead_days)` index that makes re-runs safe. Unsubscribe link round-trip proven by script 1. | Pass, after fix A |
| 2 | Unsubscribe HMAC round-trip (edge signer vs `lib/reminders/unsubscribe-token.ts` verifier) | Script 1: 1000 tokens through a faithful edge-signer reproduction. Fixed signer: 1000/1000 URL-path-safe and 1000/1000 verify. Forgery cases (tampered sig, payload swap with stale sig, wrong secret, garbage) all rejected. | Pass, after fix A |
| 3 | Records requests (`lib/outbound/records-request*.ts`, `app/api/cron/records-requests`) | Code review: authorization gate via `requireAuthorization('records_request_to_vets')`, `outbound_emails` row written up front with the NOT NULL FK to `authorizations`, pending-row scheduling and dedup by `(household_id, medical_event_id)`, cron re-validates authorization and caps per run. | Pass, after fix D |
| 4 | Unsubscribe endpoint (`app/api/unsubscribe/[token]`) | Script 1 forgery suite proves invalid or forged tokens do not verify (the route returns 400 for those). Valid token upserts `email_enabled=false`. Timing-safe comparison confirmed in the verifier. | Pass |
| 5 | Delivery webhook (`app/api/webhooks/resend`) | Script 2: missing signature 401, tampered signature 401, stale timestamp (10 min) 401, malformed JSON 400, valid signed events 200. Signed bounce flips a real `outbound_emails` row to `bounced`; signed complaint flips a real `reminders` row to `failed`. | Pass, after fix B |
| 6 | Inbound webhook (`app/api/webhooks/resend-inbound`) | Script 2: bad signature 401; unroutable recipient 200 `no_match` with no document; signed inbound with a PDF attachment creates exactly one `documents` row linked to the household with `content_hash` populated; redelivery of the same email is deduped (`documents_created:0`, still one row). | Pass, after fix C |
| 7 | Cron chain (pg_cron then vault then endpoint auth) | Read-only DB query. Both jobs `pawdex-daily-reminders` (13:00 UTC) and `pawdex-records-requests` (14:00 UTC) are `active`. Vault holds `pawdex_cron_secret` and `pawdex_app_url`. Both endpoints require `Authorization: Bearer <CRON_SECRET>` (verified in code and by the 401 responses in script 2's unsigned-analog checks). | Pass, config item C1 |

## Fixes applied (this team's files)

### A. Unsubscribe token was not URL-safe (critical)

`supabase/functions/reminders-cron/index.ts :: signUnsubToken` encoded the token
with standard base64 (`btoa(...)`), which emits `/` and `+`. The token is placed
in a URL path segment (`/api/unsubscribe/<token>`), and a `/` splits the path so
the `[token]` segment never matches. The link would 404.

This was latent because the HMAC still round-trips: the verifier hashes the exact
string it receives, and its base64url decode is lenient, so a naive "does verify
accept it" test false-passes. Script 1 asserts on the character set, not just
acceptance, and shows the old encoding: about 75 percent of tokens were not
path-safe and roughly half carried a hard-breaking `/`, yet all still verified.
That split is the proof the defect was routing, not crypto.

Fix: emit base64url for both the payload and the signature (sign over the
URL-safe payload string so the verifier reproduces the same digest).

### B. Delivery webhook never updated `outbound_emails` (high)

`app/api/webhooks/resend` updated only the `reminders` table on bounce or
complaint. Records-request, insurer-clarification, and vet-quote emails all
record into `outbound_emails` (which has its own `resend_message_id` column), so
a bounce or complaint for any of those was silently dropped. Fix: on bounced or
complained, also update `outbound_emails` by `resend_message_id` (bounce maps to
`bounced`, complaint to `failed`, since there is no `complained` status). The
`delivered` event stays a deliberate no-op on both tables (neither has a
`delivered` status; the row remains `sent`), documented in the handler.

### C. Inbound webhook did not dedupe on redelivery (high)

`app/api/webhooks/resend-inbound` inserted `documents` without `content_hash`.
The dedup index `documents_household_content_hash_uniq` is partial
(`where content_hash is not null`), so null inbound rows never deduped, and a
Resend retry of the same email created duplicate documents. Fix: compute the
SHA-256 of the attachment bytes, store it as `content_hash`, and treat a `23505`
on insert as a duplicate (drop the just-uploaded storage object, skip the row,
and do not re-kick extraction). Verified by the redelivery assertion in script 2.

### D. Records-request self-scheduling loop in the no-key state (medium, live)

`sendRecordsRequestForEvent` creates its own `pending_records_requests` row. With
a real key that row is flipped to `sent`. In the no-key branch (the current
production state) it was left on `scheduled`, so the daily cron would re-pick it
every run and spawn a fresh drafted `outbound_emails` plus a new pending row each
day, unbounded. Fix: the no-key branch now cancels the pending row it created.

### E. Embarrassing from-address fallback (low)

`reminders-cron` and `records-request.ts` fell back to `onboarding@resend.dev`
(Resend's sandbox address) when `RESEND_FROM_EMAIL` was unset. Changed to
`reminders@pawdex.app` and `records@pawdex.app`. Low severity because
`RESEND_FROM_EMAIL` is set in the environment, but the fallback should never be a
sandbox domain.

## Findings in other teams' files (not changed)

The same `onboarding@resend.dev` sandbox fallback exists in three files this team
does not own. Each should be changed to a real `@pawdex.app` sender:

- `lib/outbound/vet-quote-request.ts:181` (insurance team)
- `lib/outbound/insurer-clarification.ts:168` (insurance team)
- `app/(app)/settings/household/actions.ts:75` (household UX team)

These three also share the records-request pattern of reading `RESEND_API_KEY` at
request time (correct, no module-scope capture). Whether they have a
self-scheduling loop like fix D depends on their own pending-row handling and was
not audited here; worth a look by those owners.

## Go-live checklist (once the Resend key exists)

1. Create the Resend API key and set `RESEND_API_KEY` on both the Vercel project
   and the Supabase edge function (`reminders-cron` uses its own copy).
2. Verify the sending domain in Resend (SPF, DKIM, DMARC for `pawdex.app`) and
   set `RESEND_FROM_EMAIL` to a verified sender (for example
   `reminders@pawdex.app`). The code default is now a real domain, but set it
   explicitly.
3. Configure the delivery webhook in the Resend dashboard pointing at
   `https://<app>/api/webhooks/resend`, copy its signing secret into
   `RESEND_WEBHOOK_SECRET`. Without this secret the route refuses all requests in
   production (verified), so it must be set before enabling the webhook.
4. Configure the inbound domain and route (for example `inbound.pawdex.app`) in
   Resend, add the MX and TXT records, point the route at
   `https://<app>/api/webhooks/resend-inbound`, and copy the signing secret into
   `RESEND_INBOUND_SECRET`. Set `PAWDEX_INBOUND_DOMAIN` if not using the default.
5. C1: confirm the Bearer secret matches across all three places: the edge
   function's `CRON_SECRET`, the Next app's `CRON_SECRET`, and the vault
   `pawdex_cron_secret` value. The cron jobs read the vault value; the endpoints
   compare against their own env. If these drift, every scheduled run 401s
   silently. Also confirm `pawdex_app_url` in vault points at the production
   origin (the records-requests job builds its URL from it).
6. Deploy the edge function so the base64url token fix (A) ships:
   `supabase functions deploy reminders-cron`. Confirm its env has
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `REMINDER_UNSUBSCRIBE_SECRET`,
   `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
7. `REMINDER_UNSUBSCRIBE_SECRET` must be byte-identical on the edge function and
   the Next app, or unsubscribe links will not verify. Use a 64-char hex string.
8. Smoke test after go-live: trigger `reminders-cron` manually with the Bearer,
   confirm an email sends and its unsubscribe link resolves (200, not 404), then
   confirm a bounce webhook flips the corresponding row.
