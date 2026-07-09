# Pawdex security review — Phase 6.21

Audit pass over the system as it stands at end of Phase 6. Findings are split into **verified clean** (audited + safe) and **action items** (need follow-up).

## Verified clean

### 1. Row-level security blanket coverage

All 30 household-scoped tables fail-closed for the anon role. Verified empirically by `scripts/check-rls.ts`. Tables covered include every Phase 5+ addition: `authorizations`, `outbound_emails`, `insurance_policies`, `cost_estimates`, `extraction_chunks`, `pending_records_requests`, `household_inbound_addresses`, `share_links`, `qol_entries`, `medication_administrations`, `medication_price_quotes`, `claims`, `claim_attachments`, `lab_values`.

The policies follow one of two patterns consistently:
- **Read**: `using (public.is_household_member(household_id))`
- **Write**: `using (public.has_household_write(household_id))` with matching `with check` for inserts

Both helper functions are `SECURITY DEFINER` against `household_members` and gate on `auth.uid()`. They cannot be subverted by the anon role.

### 2. Service-role isolation

Four routes use the service-role client. Each justifies it:

| Route | Justification |
|---|---|
| `app/api/cron/records-requests/route.ts` | pg_cron POSTs as no-auth; route gates on `CRON_SECRET` Bearer header before any DB work. Service-role needed to write across all households when processing scheduled outbound emails. |
| `app/api/unsubscribe/[token]/route.ts` | Anonymous unsub link click; route verifies HMAC over the token before flipping `reminder_preferences.email_enabled`. Service-role bypass is scoped to the single matching row. |
| `app/api/webhooks/resend-inbound/route.ts` | Inbound email from Resend (no Pawdex session); verifies svix signature before any DB work. Service-role needed to write `documents` rows across households resolved from inbox slugs. |
| `app/api/webhooks/resend/route.ts` | Resend delivery webhook (no Pawdex session); verifies svix signature before any DB work. Service-role needed to update reminder rows across households. |

In every case the service-role client is **created inside the route after** signature/auth verification — never imported at module top so a CSR bug couldn't leak it. The service-role key itself is never sent to `NEXT_PUBLIC_*` env or rendered into client bundles.

### 3. Share-link entropy

`lib/db/share-links.ts:generateShareToken` uses `node:crypto.randomBytes(24)` → 192 bits of entropy, base64url-encoded → 32-char token. Stored as SHA-256 hex digest, never as raw. The raw token never round-trips to the DB and never appears in logs (only `console.log` paths emit the URL once during creation; no audit row contains it).

Comparison surface:
- 192-bit token space → astronomically resistant to brute force even with no rate limit
- TTL-bounded by `expires_at` (default 14 days, max 60)
- Revocable in one click (`revoked_at` flips, no token rotation needed)
- Per-token access count + last-accessed timestamp → trivial to detect anomalous activity

### 4. Authorization-before-outbound discipline

Every outbound email path goes through `requireAuthorization()` from `lib/auth/authorizations.ts`. Audited surfaces:

- `lib/outbound/records-request.ts` → `records_request_to_vets`
- `lib/outbound/vet-quote-request.ts` → `records_request_to_vets` (reused — same conceptual permission)
- `lib/outbound/insurer-clarification.ts` → `insurer_clarification_emails`

`outbound_emails.authorization_id` is `NOT NULL` at the DB layer — a row cannot be inserted without an authorization id, so even a future code path that forgets the helper fails at insert time.

### 5. Audit-log coverage

Spot-checked these outbound actions and confirmed each has a `recordAudit()` call after success:

- Authorization grant + revoke
- Outbound email creation (records request, vet quote, insurer clarification)
- Share-link create + revoke
- Insurance policy create + AI extraction commit
- Claim create + update + delete
- Cost estimate create + delete
- Medication administration mark + undo
- Lab value add + delete
- QoL entry save + delete

The audit_log table itself is RLS-scoped to household membership — readable in `/settings/activity` by household members only.

### 6. HMAC discipline on signed URLs

- Reminder unsubscribe tokens are HMAC-SHA256 over `householdId:expiresAt` with `REMINDER_UNSUBSCRIBE_SECRET`. Verified by `crypto.timingSafeEqual` against the signature claimed in the URL.
- Resend webhooks (inbound + delivery) verify svix signatures with `RESEND_*_SECRET`. Tolerance: 5 minutes against the timestamp header to defeat replay.
- pg_cron auth is a Bearer compare against `CRON_SECRET` (HTTP, not HMAC — fine for a server-only secret on a trusted internal call).

### 7. PII isolation on inbound email

`/api/webhooks/resend-inbound` parses Resend's inbound payload and stores **only** the file attachment + the sender's email (in audit_log diff) + the subject + the slug match outcome. The full email body and recipient list are dropped — not indexed, not embedded.

## Action items

### 1. Add HTTP rate limit on `/api/webhooks/resend-inbound`

**Severity: medium.** The route is unauthenticated until svix signature verification (which itself has a 5-minute timestamp tolerance). If `RESEND_INBOUND_SECRET` is ever rotated and the rotation lags Resend, the route could fall back to "dev mode accept" by env-var misconfiguration. Mitigation: add `vercel.json` `headers` rate-limit or use Vercel BotID + a per-IP cap. Not a current vulnerability — only a defense-in-depth gap.

### 2. Add HTTP rate limit on `/share/[token]`

**Severity: low.** A 192-bit token space is brute-force-proof in practice, but a tight rate limit hardens against credential-stuffing if someone leaks a token via screen-share. Add a per-IP cap (Vercel Edge Config or a free Upstash Redis tier).

### 3. Quote the inbound `RESEND_INBOUND_SECRET` enforcement in prod

`app/api/webhooks/resend-inbound/route.ts` falls back to "accept unsigned event in dev mode" when `RESEND_INBOUND_SECRET` is unset. This is correct for dev but a `NODE_ENV === "production"` gate would harden against a missed-secret deploy. The same applies to `app/api/webhooks/resend/route.ts` and `app/api/cron/records-requests/route.ts`.

```ts
if (process.env.NODE_ENV === "production" && !secret) {
  return NextResponse.json({ error: "secret not configured" }, { status: 500 });
}
```

Add this to all three. Trivial change.

### 4. Confirm Supabase Storage RLS on `documents` bucket

`scripts/check-rls.ts` audits Postgres tables but not storage policies. Manually verify with `select * from storage.policies where bucket_id = 'documents'` and confirm the read policy is `storage.foldername(name)[1]::uuid = any (...)` against `household_members`. The Phase 1 setup did this correctly; flag this as a "verify after each migration" item in DEPLOY.md.

### 5. Lock down `lib/ai/qa.ts` to household scope

`match_extraction_chunks` Postgres function is `SECURITY STABLE` and requires `p_household_id` as a parameter. The current caller in `lib/ai/qa.ts` passes `session.householdId` from `requireSession()` — safe. **But** the RPC bypasses RLS (it's an unprivileged function). If a future caller forgot to pass the household_id or passed an attacker-controlled value, it would leak cross-household. Recommend: change the function signature to read `auth.uid()` directly and join through `household_members`, or add a defensive `where ec.household_id in (select household_id from public.household_members where user_id = auth.uid())` inside the function body.

Action items 3, 4, 5 are low-effort hardenings; 1 and 2 require Vercel-side rate-limiting infrastructure that's worth bundling with a Phase 7 deploy when traffic justifies it.

---

## Threat model summary

| Threat | Mitigation | Status |
|---|---|---|
| Cross-household data leak via RLS bypass | Anon read tests + audit | ✅ Verified |
| Service-role key exposure to client | No `NEXT_PUBLIC_` env var; created inside server routes only | ✅ Verified |
| Outbound email without consent | Authorization gate on every outbound path + `NOT NULL` FK | ✅ Verified |
| Share-link enumeration | 192-bit token; SHA-256 storage; expiry + revoke | ✅ Verified |
| Replay of signed unsub link | HMAC over `householdId:expiresAt`; one-shot link semantics | ✅ Verified |
| Replay of Resend webhook | svix signature + 5-minute timestamp window | ✅ Verified |
| Inbound email-body PII storage | Body discarded; only attachments + sender stored | ✅ Verified |
| Brute-force of share tokens | No rate limit on `/share/[token]` (192-bit space makes it infeasible regardless) | ⚠️ Add rate limit before launch |
| Misconfigured webhook secret in prod | Dev-mode-accept fallback active | ⚠️ Add `NODE_ENV === "production"` gate |
| RPC bypasses RLS by accepting `p_household_id` from caller | Caller always uses `session.householdId` | ⚠️ Add defensive `auth.uid()` check inside the function |

No critical findings. Pre-launch with the three medium-severity items addressed.
