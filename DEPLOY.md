# Pawdex — production deploy checklist

This is the operational runbook for taking Pawdex from local-dev to a hosted environment. Follow top-to-bottom on a fresh project; pick the relevant section when adding a new piece of infrastructure to an existing deploy.

---

## 1. Environment variable inventory

Every required + optional env var Pawdex reads. Group by where the value lives.

### Local development (`.env.local`)

| Var | Required | Source / how to obtain |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase dashboard → Project Settings → API. Public — used by browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Same dashboard page. Public. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Same dashboard page. **Server-only — never expose to client.** |
| `OPENROUTER_API_KEY` | ✅ for AI | openrouter.ai/keys |
| `OPENROUTER_MODEL_TIER1` | optional | Default `google/gemini-2.5-flash-lite` |
| `OPENROUTER_MODEL_TIER2` | optional | Default `google/gemini-2.5-flash` |
| `OPENROUTER_MODEL_TIER3` | optional | Default `anthropic/claude-sonnet-4.5` |
| `OPENROUTER_APP_NAME` | optional | Sent as `X-Title` header on OpenRouter calls |
| `OPENROUTER_REFERRER` | optional | Sent as `HTTP-Referer` header |
| `OPENAI_API_KEY` | ✅ for doc Q&A | openai.com — used only for `text-embedding-3-small` |
| `OPENAI_EMBEDDING_MODEL` | optional | Default `text-embedding-3-small` |
| `RESEND_API_KEY` | ✅ for any email | resend.com |
| `RESEND_FROM_EMAIL` | ✅ for any email | A verified-domain sender; in dev `onboarding@resend.dev` is fine |
| `RESEND_WEBHOOK_SECRET` | ✅ in prod | Resend delivery webhook signing secret (`whsec_…`) |
| `RESEND_INBOUND_SECRET` | ✅ in prod | Resend Inbound webhook signing secret (`whsec_…`) |
| `PAWDEX_INBOUND_DOMAIN` | optional | Defaults to `inbound.pawdex.app` |
| `CRON_SECRET` | ✅ in prod | 32-byte hex string (`openssl rand -hex 32`). Same value must land in Supabase Vault — see below. |
| `REMINDER_UNSUBSCRIBE_SECRET` | ✅ for reminders | 32-byte hex string for HMAC unsubscribe tokens. Must match the Edge Function's secret. |
| `NEXT_PUBLIC_APP_URL` | ✅ for shared links | `http://localhost:3000` or your production URL — used in share-link URLs |

### Supabase Vault (set once via SQL editor)

```sql
-- The cron secret read by pg_cron http_post for the daily reminder + records-request jobs.
select vault.create_secret('your-32-byte-hex-string', 'pawdex_cron_secret');

-- Your deployed app URL (used by pawdex-records-requests cron to call /api/cron/records-requests).
select vault.create_secret('https://your-app.vercel.app', 'pawdex_app_url');
```

Both values must match the same `CRON_SECRET` + `NEXT_PUBLIC_APP_URL` you set in your hosting environment.

### Supabase Edge Function secrets (set via the dashboard)

For the `reminders-cron` Edge Function:

| Key | Value |
|---|---|
| `CRON_SECRET` | Same hex string as `.env.local` and Vault |
| `RESEND_API_KEY` | Your `re_…` key |
| `RESEND_FROM_EMAIL` | Verified sender |
| `REMINDER_UNSUBSCRIBE_SECRET` | Same hex string as `.env.local` |
| `NEXT_PUBLIC_APP_URL` | Production URL (used in email links) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided to Edge Functions.

### Vercel project env (production)

Mirror every value from `.env.local` to Vercel project settings → Environment Variables. `NEXT_PUBLIC_*` vars must be set for both Production and Preview deployments.

---

## 2. Database migrations

Apply in order via `pnpm dlx supabase db push` or the Supabase MCP. The file list grows; check `supabase/migrations/` for the canonical order. Phase 6 migrations include:

- `share_links_table` (Phase 6.6)
- `qol_entries_table` (Phase 6.4)
- `medication_administrations_table` (Phase 6.12)
- `medication_price_quotes` (Phase 6.13)
- `claims_table` (Phase 6.14)
- `lab_values_table` (Phase 6.18)
- `auto_request_records_toggle` (Phase 5.6)
- `documents_content_hash` (Phase 5.18)

After migrations land, run the backfill script for hashes on legacy documents:

```bash
set -a && source .env.local && set +a
pnpm dlx tsx scripts/backfill-content-hash.ts
```

Re-runnable — only touches `content_hash IS NULL` rows.

---

## 3. DNS configuration

| Subdomain | Type | Target | Purpose |
|---|---|---|---|
| `pawdex.app` | A / CNAME | Vercel | Production app |
| `reminders.pawdex.app` | TXT + DKIM | Resend's records | Sender domain for transactional email (or use a subdomain Resend assigns) |
| `inbound.pawdex.app` | MX 10 | `feedback-smtp.us-east-1.amazonses.com.` | Receives forwarded vet email |
| `inbound.pawdex.app` | TXT | `v=spf1 include:amazonses.com ~all` | SPF for Resend Inbound |

The Resend dashboard shows the exact records for both outbound + inbound — copy them verbatim.

---

## 4. Resend configuration

### Outbound delivery webhook

Resend → **Webhooks → Add Endpoint** → `https://pawdex.app/api/webhooks/resend`. Events: `email.delivered`, `email.bounced`, `email.complained`. Copy the signing secret to `RESEND_WEBHOOK_SECRET`.

### Inbound route

Resend → **Inbound → Add Route**.

| Field | Value |
|---|---|
| Domain | `inbound.pawdex.app` |
| Destination | `https://pawdex.app/api/webhooks/resend-inbound` |
| Forwarding | Off |
| Signing secret | Copy → set `RESEND_INBOUND_SECRET` |

Verify with `curl -X POST https://pawdex.app/api/webhooks/resend-inbound -d '{}' -H 'content-type: application/json'`. Expect a 401 (no signature) or 200 with `{"ok":true,"status":"no_match"}`.

---

## 5. Supabase Edge Function deploy

```bash
pnpm dlx supabase functions deploy reminders-cron \
  --project-ref <ref> \
  --no-verify-jwt
```

The `--no-verify-jwt` flag is critical — the function authenticates via the `CRON_SECRET` Bearer header, not a Supabase JWT.

---

## 6. pg_cron schedules

After applying the migration that registers `cron.schedule()`, verify the jobs are active:

```sql
select jobname, schedule, active from cron.job where jobname like 'pawdex%';
-- Expect:
--   pawdex-daily-reminders     0 13 * * *   t
--   pawdex-records-requests    0 14 * * *   t
```

To trigger manually for testing:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'pawdex_app_url' limit 1) || '/api/cron/records-requests',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pawdex_cron_secret' limit 1)
  ),
  body := '{"manual":true}'::jsonb
);
```

---

## 7. Pre-launch verification checklist

Run through this before flipping DNS:

- [ ] `pnpm tsc --noEmit` — clean
- [ ] `pnpm build` — clean
- [ ] `pnpm dlx tsx scripts/check-rls.ts` — every table fails closed for anon
- [ ] `pnpm dlx tsx scripts/backfill-content-hash.ts` — no remaining null hashes (`select count(*) from documents where content_hash is null` returns 0)
- [ ] Manual smoke: sign up → onboard → create pet → upload PDF → review → commit → see vaccine appear → /expiring shows it
- [ ] Manual smoke: forward an email to inbox slug → land on /inbox → assign to pet → extraction runs
- [ ] Manual smoke: grant `records_request_to_vets` authorization → log a medical event with a vet that has email → "Request records" button works
- [ ] Manual smoke: create a boarding share link → load it in an incognito window → confirm read-only render → revoke → confirm link is dead
- [ ] Email-delivery audit: send a vaccine reminder to your own email; verify the unsubscribe link round-trips

---

## 8. Backups + DR

Supabase Postgres is point-in-time backed up automatically (free tier: 7 days; Pro: 14+ days). Storage objects are durable but **not** included in the point-in-time backup. Set up a periodic `storage.objects` snapshot to a separate bucket or S3 sink for true disaster recovery.

The `documents` storage bucket is the only data Pawdex stores outside Postgres — if you can restore Postgres and the storage bucket together, you can restore the app.

---

## 9. Monitoring

Quick-and-cheap signals to wire when ready:

- **Supabase logs** for `processDocumentExtraction failed`, `processPolicyExtraction failed`, `[resend webhook]` warnings.
- **Vercel function logs** for `/api/cron/records-requests` and `/api/webhooks/resend-inbound` — these are the highest-blast-radius surfaces.
- **OpenRouter dashboard** spend per day — set a daily credit cap.
- **Audit log table** queries: `select action, count(*) from audit_log where created_at > now() - interval '1 day' group by 1` — sanity-check that outbound actions aren't running away.

---

## 10. Common deploy mistakes Pawdex specifically trips on

- Forgetting to put the same `CRON_SECRET` in **three places** (`.env.local`, Supabase Vault, Edge Function secrets). Symptom: cron 401s.
- Letting `RESEND_FROM_EMAIL` default to `onboarding@resend.dev` in production. Symptom: vet clinics' spam filters drop the email silently.
- Setting `PAWDEX_INBOUND_DOMAIN` but forgetting the MX record. Symptom: forwarded emails bounce, nothing appears in /inbox.
- Forgetting to set the `pawdex_app_url` Vault secret. Symptom: the records-request cron fires but POSTs to `https://example.invalid` and the Vercel function never hears about it.
- Forgetting to enable `--no-verify-jwt` on the Edge Function. Symptom: the cron 401s with "Invalid JWT".
- Forgetting to run the `backfill-content-hash.ts` script after schema changes. Symptom: legacy duplicate documents still allowed.

If you hit any of these, the fix is in the section above that introduced them.
