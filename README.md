# Pawdex

AI-native pet medical records — upload any vet document (vaccine cert, SOAP note, lab report, invoice) and Pawdex keeps your pets' history searchable and on schedule.

Personal use first, multi-tenant from day one so monetization is a flip-the-switch later.

## Stack

- Next.js 16 (App Router, Turbopack) on Vercel
- Supabase (Postgres + Auth + Storage + RLS)
- OpenRouter (`@openrouter/ai-sdk-provider`) → Gemini 2.5 Flash-Lite for extraction
- Resend for transactional email
- shadcn/ui + Tailwind v4

## Phase 1 setup

This branch ships Phase 1 — auth, manual data entry, dashboard. AI extraction lands in Phase 2.

### 1. Provision Supabase

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. From **Settings → API**, copy the URL, anon key, and service-role key.
3. Apply the migrations in `supabase/migrations/` in numeric order via the SQL editor or the Supabase CLI:
   ```bash
   pnpm dlx supabase link --project-ref <ref>
   pnpm dlx supabase db push
   ```
4. (Recommended) Regenerate the typed database to replace the hand-authored types:
   ```bash
   pnpm dlx supabase gen types typescript --project-id <ref> > lib/supabase/types.gen.ts
   ```
   Then update `lib/supabase/types.ts` to re-export from `types.gen.ts`.

### 2. Configure auth

In the Supabase dashboard → **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (dev) or your production URL
- Redirect URLs: add `http://localhost:3000/auth/callback`

### 3. Local environment

```bash
cp .env.local.example .env.local
# Fill in the Supabase values; OpenRouter / Resend keys are not needed until Phase 2/3.
```

Generate the cron and unsubscribe secrets (Phase 3 will use them):

```bash
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # REMINDER_UNSUBSCRIBE_SECRET
```

### 4. Run the dev server

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Magic-link sign-in via the email you configured on Supabase Auth. After the first login, a household is auto-created and you land on the dashboard.

## Phase 2 setup (document ingestion)

Phase 2 adds AI extraction of vet documents via OpenRouter → Gemini Flash-Lite.

### Required env vars (`.env.local`)

```
OPENROUTER_API_KEY=sk-or-v1-...       # https://openrouter.ai/keys
OPENROUTER_MODEL_TIER1=google/gemini-2.5-flash-lite
OPENROUTER_MODEL_TIER2=google/gemini-2.5-flash
OPENROUTER_MODEL_TIER3=anthropic/claude-sonnet-4.5
OPENROUTER_APP_NAME=pawdex
OPENROUTER_REFERRER=http://localhost:3000
```

Fund OpenRouter with a small initial credit ($5 covers thousands of extractions at Flash-Lite tier).

### How extraction works

Upload a PDF or photo → routed through 3-tier escalation:
1. **Tier 1** Gemini Flash-Lite (batch hint) — default for everything.
2. **Tier 2** Gemini Flash — escalates if Tier 1's `confidence_overall < 0.85` or schema parse fails.
3. **Tier 3** Claude Sonnet 4.5 — escalates further on Tier 2 failure, OR forced for rabies certificates (legal-significance heuristic on filename).

Extractions land in `document_extractions` as `pending_review`. The user reviews + edits in a split-screen UI, optionally rates the extraction quality (the feedback loop seeds future prompt improvements), then commits. Committing inserts canonical rows into `vaccinations` / `medications` / `medical_events` / `weight_log` and flips the document to `confirmed`.

## Phase 3 setup (reminder emails)

Phase 3 adds daily reminder emails for expiring vaccines, driven by Supabase pg_cron → Edge Function → Resend.

### 1. Generate two secrets locally

```bash
openssl rand -hex 32   # CRON_SECRET — authenticates pg_cron → Edge Function
openssl rand -hex 32   # REMINDER_UNSUBSCRIBE_SECRET — signs one-click unsub links
```

Drop both into `.env.local`:
```
CRON_SECRET=<first hex string>
REMINDER_UNSUBSCRIBE_SECRET=<second hex string>
```

### 2. Get a Resend API key

1. Sign up at [resend.com](https://resend.com), grab an API key (`re_xxx`) from **Settings → API Keys**.
2. For dev, use Resend's shared sender by leaving `RESEND_FROM_EMAIL=onboarding@resend.dev`. **Caveat:** with this sender, Resend only delivers to email addresses verified on your Resend account.
3. For prod, verify a custom sending domain in Resend (DNS records) and switch `RESEND_FROM_EMAIL=reminders@yourdomain.app`.

Add to `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### 3. Seed the cron secret in Supabase Vault

In the Supabase dashboard SQL editor, run **once** (using the same value as your `CRON_SECRET`):

```sql
select vault.create_secret('<YOUR_CRON_SECRET_HEX>', 'pawdex_cron_secret');
```

This is what the pg_cron schedule reads at runtime to send the Bearer token to the Edge Function. Encrypted at rest.

### 4. Set the Edge Function secrets

Supabase dashboard → **Edge Functions → reminders-cron → Settings → Secrets**, add:

| Key | Value |
|---|---|
| `CRON_SECRET` | same hex string as `.env.local` |
| `RESEND_API_KEY` | your `re_xxx` |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` (dev) or your verified domain |
| `REMINDER_UNSUBSCRIBE_SECRET` | same hex string as `.env.local` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (dev) or your prod URL |

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided to Edge Functions.)

### 5. (Optional but recommended) Wire the Resend delivery webhook

So Pawdex can react to bounces / spam complaints and automatically disable reminders after repeated failures.

1. Resend dashboard → **Webhooks → Add Endpoint**
2. URL: `https://<your-domain>/api/webhooks/resend` (prod) — for dev, expose with `ngrok http 3000` and use the tunnel URL
3. Events: `email.delivered`, `email.bounced`, `email.complained`
4. Copy the signing secret → add to `.env.local`:
   ```
   RESEND_WEBHOOK_SECRET=whsec_xxx
   ```

If you skip this, the route handler accepts unsigned events in dev with a console warning. **Do not skip in prod.**

### 6. Test it end-to-end

1. Sign in to the app, navigate to **/reminders** as the household owner.
2. Click **"Run reminders now"** (calls the Edge Function with your `CRON_SECRET`).
3. Expect a JSON response like `{ reminders_computed: N, emails_sent: M, ... }`.
4. To force a real send: edit a vaccination's `expires_on` to today + 1 day in the SQL editor or via the manual entry form, then re-run.
5. Check your inbox — the email should land within seconds with the deep link, unsubscribe link, and "Manage preferences" link all working.

### Daily schedule

`pg_cron` fires at `0 13 * * *` UTC (~8am ET) every day. View the schedule with:

```sql
select * from cron.job where jobname = 'pawdex-daily-reminders';
select * from cron.job_run_details where jobid = (
  select jobid from cron.job where jobname = 'pawdex-daily-reminders'
) order by start_time desc limit 10;
```

### Troubleshooting

- **401 from Edge Function**: `CRON_SECRET` mismatch between `.env.local`, Supabase Vault, and Edge Function secrets — they all need to be the same string.
- **No emails sent**: check `reminder_preferences.email_enabled` for the household (must be true). Check that the household owner's auth email is verified in Resend (if using `onboarding@resend.dev`).
- **Webhook 401s**: `RESEND_WEBHOOK_SECRET` must start with `whsec_` and match exactly what Resend gives you.
- **Cron fires but inserts nothing**: nothing expired in the next 35 days. Backdate a vaccine to verify.

## Phase 5 setup (AI-native automation: forwarding inbox + outbound vet requests)

Phase 5 adds two breakthrough flows on top of the staged extraction pipeline:

- **Email-forwarding ingestion** — every household gets a unique `inbox+{slug}@inbound.pawdex.app` address. Forwarded vet emails auto-ingest via Resend Inbound, attachments become document rows, extraction runs in the background, and the new `/inbox` page lets you assign each to a pet.
- **Records-request automation** — from a pet's medical history, one click drafts and sends a templated records-request email to the clinic. The email's `Reply-To` is set to the household's inbox slug, so the clinic's response routes straight back into Pawdex.

Every outbound action is gated behind an `authorizations` row managed at `/settings/authorizations`.

### 1. Local env additions

Append to `.env.local`:

```
# Resend Inbound (parsed inbound email webhook)
RESEND_INBOUND_SECRET=whsec_xxx              # from the Resend dashboard
PAWDEX_INBOUND_DOMAIN=inbound.pawdex.app     # optional — defaults to this string
```

### 2. DNS + Resend Inbound configuration

In your DNS provider, point your inbound subdomain at Resend (the dashboard shows the current MX target):

```
inbound.pawdex.app   MX 10   feedback-smtp.us-east-1.amazonses.com.
inbound.pawdex.app   TXT     "v=spf1 include:amazonses.com ~all"
```

Then in Resend → **Inbound → Add Route**:

| Field | Value |
|---|---|
| Domain | `inbound.pawdex.app` |
| Destination | `https://<your-app>/api/webhooks/resend-inbound` |
| Forwarding | Off (we want raw webhook delivery) |
| Signing secret | Copy → set `RESEND_INBOUND_SECRET` in `.env.local` *and* on Vercel |

For local dev, expose your dev server with `ngrok http 3000` and point the Resend route at the tunnel URL while you test.

### 3. Sender domain for outbound vet email

The records-request flow reuses your existing Resend account. The `RESEND_FROM_EMAIL` already set in Phase 3 is the From address — use a verified-domain address in prod, not `onboarding@resend.dev`, or the clinic's spam filter will drop it.

### 4. Granting authorizations

Open `/settings/authorizations` as the household owner and grant **Request records from my vets** before the "Request records" button on the medical events table works. The scope text is shown in the disclosure panel — read it before granting. Every grant captures timestamp, IP, user-agent, and the exact wording you agreed to.

### 5. Verifying end-to-end

1. **Forwarding** — forward a real vet email (with PDF) to your household's address from `/settings`. Within ~10 seconds, the document should appear on `/inbox` with extraction running.
2. **Outbound** — on `/pets/<id>/medical`, find a row whose clinic has an email on file. The "Request records" button should be enabled. Click it. Within a few seconds, the row updates to "Request sent" and an entry lands in `/settings/activity`.
3. **Round-trip** — the records-request email's `Reply-To` is your inbox slug. When the clinic replies with PDFs, they auto-ingest as inbound documents.

### Troubleshooting

- **Webhook 401**: `RESEND_INBOUND_SECRET` must match Resend's signing secret exactly (starts with `whsec_`).
- **`no_match` in webhook logs**: the recipient address doesn't match an active household slug. Check that you forwarded *to* the address, not *from* it (some mail clients prepend `Fwd:` to From).
- **Records-request button missing**: medical event has no `vet_clinic_id`, or the clinic has no `email`. Edit the visit or the clinic detail.
- **"Grant authorization" instead of the button**: the household hasn't granted `records_request_to_vets`. Visit `/settings/authorizations`.

## Phase 5 round 2 setup (auto-records, Q&A, insurance, compliance packet)

Round 2 adds four features on top of round 1:

- **Auto-schedule records requests** — a `/settings` toggle that enqueues a records-request email N days after every logged visit. A daily Next route handler (`/api/cron/records-requests`) processes the queue.
- **Doc Q&A** at `/ask` — pgvector cosine search over committed extractions, answered by Sonnet 4.5 with inline citations linking back to source documents.
- **Insurance policies** at `/insurance` — manual entry of premium / deductible / reimbursement / exclusions for each policy. Foundation for true-OOP calculator + PEC flagger in a later round.
- **Compliance packet** at `/pets/[id]/packet` — print-ready summary of identity + microchip + current vaccinations + primary vet, formatted for boarding / airlines / travel. `Cmd+P` → save as PDF.

### 1. Env additions

Append to `.env.local`:

```
# Embeddings for /ask doc Q&A (OpenAI text-embedding-3-small, 1536 dims)
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small   # optional override
```

Why a separate provider for embeddings: OpenRouter doesn't expose embedding endpoints. OpenAI's `text-embedding-3-small` is ~$0.02 per million tokens — negligible for personal use, and dimension-matched to the `extraction_chunks.embedding vector(1536)` column.

### 2. Records-requests cron secret

The cron route handler at `/api/cron/records-requests` is invoked once a day by Supabase pg_cron (`pawdex-records-requests`, 14:00 UTC). It authenticates via the same `pawdex_cron_secret` Vault item already used by the reminders cron. The cron also needs to know the app URL, which lives in a separate Vault secret:

```sql
-- Set once in the Supabase SQL editor.
-- Replace the URL with your production deploy (no trailing slash).
select vault.create_secret('https://your-app.vercel.app', 'pawdex_app_url');
```

For local dev, expose your dev server with `ngrok http 3000` and use the tunnel URL.

Verify the cron is scheduled:

```sql
select jobname, schedule from cron.job where jobname like 'pawdex%';
-- Expected:
--   pawdex-daily-reminders     0 13 * * *
--   pawdex-records-requests    0 14 * * *
```

### 3. Backfill embeddings for existing committed documents

The indexer fires automatically on every new commit. To backfill embeddings for documents you committed before round 2 shipped, manually re-commit them — `commitExtraction` will re-trigger indexing — or write a one-off script that loops `document_extractions` rows in `committed` status and calls `indexExtractionForQa` directly.

### 4. Verifying

1. **Q&A** — open `/ask`. With no committed documents, the page shows the empty state. After at least one commit, type a question; the answer should arrive with [#N] citations linking to the source document.
2. **Insurance** — open `/insurance` → expand "Add a policy" → fill in any subset → save. The card appears with computed reimbursement %, deductible, etc.
3. **Compliance packet** — open `/pets/<id>/packet`. The page renders a print-ready layout. Verify the toolbar (Back, Print) disappears under `Cmd+P` preview.
4. **Auto-records** — `/settings` → flip "Auto-request SOAP notes after every visit" on. Add a medical event with a vet clinic email on file. A row should appear in `pending_records_requests` scheduled for `occurred_on + 1`. Manually invoke the cron with `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/records-requests` to drain the queue.

### Deferred to a future round

- True out-of-pocket cost calculator that emails the vet for an estimate, ingests the response, and computes net OOP.
- Insurer clarification email drafts (requires `insurer_clarification_emails` authorization).
- USDA APHIS 7001 + EU pet passport variants of the compliance packet.

## Phase 5 round 3 setup (AI policy extraction, PEC flagger, pre-visit briefing)

Round 3 layers on top of round 2's manual insurance + Q&A foundation:

- **Pre-visit briefing** at `/pets/[id]/briefing` — print-ready prep sheet for vet visits showing recent illness/injury, current take-home meds, weight trend, recent labs, and 5 write-in lines for questions. Designed to be handed to the vet on arrival.
- **AI policy extraction** at `/insurance/upload` — drop in a policy PDF, Sonnet 4.5 parses insurer, plan, deductible, reimbursement, exclusions (verbatim), and PEC definitions into the `insurance_policies` row. Original PDF is preserved.
- **Pre-existing condition flagger** — surfaces on `/insurance` directly below each policy card. Cross-references each policy's exclusion list against the household's `medical_events` via token-overlap matching (heuristic, deterministic, auditable). Flagged events are listed with the matching exclusion. Always framed as informational — never authoritative.

### How AI policy extraction works

1. `/insurance/upload` → pick PDF/image → form action uploads to Supabase Storage at `{household_id}/insurance/{uuid}.{ext}`, inserts a `documents` row + a placeholder `insurance_policies` row with `insurer_name = 'Pending extraction…'`.
2. `processPolicyExtraction()` fires via `after()` post-redirect. It downloads the file, calls Sonnet 4.5 with the policy-focused prompt + Zod schema in [lib/ai/extract-policy.ts](lib/ai/extract-policy.ts), then upserts the parsed fields into the placeholder row.
3. The user lands back on `/insurance` and sees the new card populate within ~30 seconds (refresh the page after ~30s for now — a polling refresh layer is a future improvement).
4. Fields the user already filled in manually are NOT overwritten (`coalesce` semantics): only the placeholder name gets replaced and `null` fields get populated.

### How the PEC flagger works

- Lowercases + strips non-alphanumerics on both sides, splits into tokens, drops a stopword list (`treatment`, `condition`, `vet`, etc.).
- Requires ≥ 2 distinct non-stopword tokens shared between an exclusion and an event title+diagnosis to count as a match. This skips "ear infection" matching "ear cropping" while catching "hip dysplasia diagnosed bilateral" matching "hip dysplasia" exclusion.
- Pet-scoped policies (those with `pet_id` set) only match against that pet's events.
- Pure server-side, no AI cost. Future enhancement: layer a Tier 2 Flash refinement pass behind an "AI confirm" button for higher precision.

### Setup

Round 3 reuses existing env vars — no new keys to add. The policy extractor uses the same `OPENROUTER_API_KEY` and Tier 3 model already configured.

### Verifying

1. **Pre-visit briefing** — open `/pets/<id>/briefing`. With logged events + meds + weights, sections populate. The "Questions for the vet" write-in lines render with horizontal rules for hand-writing.
2. **AI policy upload** — click "Upload policy PDF" on `/insurance`, pick a real policy PDF, submit. Wait ~30s, refresh `/insurance`. The placeholder card should now show the real insurer, deductible, reimbursement, and a parsed exclusions list.
3. **PEC flagger** — once a policy has `extracted_exclusions` populated AND the household has a medical event with a matching diagnosis (e.g. exclusion contains "hip dysplasia" and there's a medical_event titled "Hip dysplasia x-ray confirmed"), the policy card displays an amber "Possible pre-existing match" panel listing the flagged events.

## Phase 5 round 4 setup (true-OOP calculator + insurer clarification drafts)

Round 4 ties two more pieces of the insurance intelligence story:

- **True out-of-pocket calculator** at `/insurance/[id]/estimate` — type the vet's gross estimate, pick a pet, override the deductible-remaining if you've already met part of it. Pawdex deterministically applies `gross − deductible_applied → eligible × reimbursement_rate → true OOP`. Result is persisted as a `cost_estimates` row and listed below the form. Pure math, no AI cost.
- **Insurer clarification drafts** at `/insurance/[id]/clarify` — write your question in plain English, Sonnet drafts a neutral factual email (no advocacy, no admissions). You review + edit + supply the insurer's email + click Send. Email goes out via Resend with Reply-To set to your household inbox, audit row in `outbound_emails`. Gated behind the `insurer_clarification_emails` authorization.

### How the OOP calculator decides

```
applied_deductible    = min(deductible_remaining, gross)
eligible              = max(0, gross − applied_deductible)
insurance_pays        = eligible × reimbursement_rate, capped at annual_max_remaining
true_oop              = gross − insurance_pays
```

Missing values degrade gracefully — no reimbursement_rate → no reimbursement (true_oop = gross), no annual_max → no cap. Annual maximum *remaining* is set to the full annual max in v1 (we don't track YTD claims yet) — override behavior comes in a future round.

### How the clarification draft enforces tone

The Sonnet system prompt at [lib/outbound/insurer-clarification.ts](lib/outbound/insurer-clarification.ts) has hard rules: neutral framing, no demands, no admissions, no medical opinions, brief (4–6 sentences), single specific question, sign-off as the policyholder, attribution that the email was drafted via Pawdex under authorization. Subject lines follow `Policy clarification request — [topic]`.

If you grant the `insurer_clarification_emails` authorization first, the Send button is enabled. Otherwise the draft is still composed but Send is gated.

### Verifying

1. **OOP** — on `/insurance`, click "Estimate" on a policy card. Fill in procedure + pet + gross estimate. Submit. The card list below shows the breakdown with insurance-pays vs you-pay. Try a gross value below your deductible — true OOP should equal gross (all on you).
2. **Clarification** — on `/insurance`, click "Ask insurer" on a policy card. Type a question. Hit "Draft email". An editable form appears with the AI draft. Without the authorization, Send is greyed. With it, fill in the insurer's email, edit if needed, click Send.

### Still deferred to a future round

- Vet-quote round-trip for OOP (auto-email vet for an estimate, ingest the reply, parse the estimate, compute OOP without manual entry).
- YTD-claims tracking so annual_max + deductible_remaining auto-populate.
- Tier 2 LLM refinement for PEC matches (precision upgrade on the heuristic).
- USDA APHIS 7001 + EU pet passport variants of the compliance packet.
- Longitudinal lab trend detection (multi-visit ALT/creatinine/weight trends with plain-language alerts).
- Claims workflow + appeal assistance.

## Phase 6.1 — EU pet passport re-compliance flow

Phase 6 opens with the time-sensitive wedge from the plan: every US/UK/CA owner with a pre-2026-04-22 EU pet passport is now non-compliant. Pawdex's pitch is a checklist that walks them through exactly what's missing.

### What it does

`/pets/[id]/eu-travel?to=<COUNTRY_CODE>&date=<YYYY-MM-DD>` renders a destination-aware compliance report against post-2026-04-22 EU entry rules:

- **ISO 11784/11785 microchip** — 15-digit numeric, on file. Warns on non-ISO chips; blocks on missing.
- **Age ≥ 15 weeks at travel** — uses pet DOB + (optional) travel date. Blocker if under-age at travel.
- **Current rabies vaccination** — latest-rabies-per-pet, not expired at travel date.
- **Chip-implanted-before-rabies ordering** — surfaced as a `to-do` because we don't store the chip implant date; user confirms with the issuing vet.
- **Rabies titer (FAVN, ≥ 0.5 IU/ml)** — required for non-listed third-country origin (USA, etc.). Detected from `medical_events` containing FAVN / titer keywords. Validates the 30-day post-vaccine gap and 3-month pre-travel lead time.
- **Echinococcus / tapeworm treatment** — only required for **GB, IE, FI, MT, NO**. Validates the 24–120 hour pre-arrival window against `medications` + `medical_events` matching praziquantel / drontal / droncit / echinococcus keywords.
- **EU Animal Health Certificate (USDA APHIS 7001)** — always a `to-do` since we don't store the form; the page reminds the user to schedule the issuance appointment within 10 days of travel.

### Architecture

- Pure computation in [lib/compliance/eu-passport.ts](lib/compliance/eu-passport.ts) — no new schema. Reads vaccines / meds / events from the existing tables.
- Server-rendered page at [pets/[id]/eu-travel/page.tsx](app/(app)/pets/[petId]/eu-travel/page.tsx) with a print-friendly layout. Toolbar + selector are hidden on `Cmd+P` so the printed copy is clean for handing to a USDA-accredited vet.
- Client-side [DestinationSelector](app/(app)/pets/[petId]/eu-travel/destination-selector.tsx) syncs `?to=...&date=...` to the URL so links are shareable / bookmarkable for a specific trip.
- Pet header now has an **EU travel** button alongside **Briefing** and **Packet**.

### Verifying

1. Open `/pets/<id>/eu-travel` for a pet with at least a microchip + rabies on file. Default destination is France.
2. Switch destination to **United Kingdom** — the tapeworm requirement appears. Without a praziquantel record, it shows as a Blocker.
3. Set a travel date 2 weeks from now — age and rabies-expiry checks evaluate against that date.
4. Click "Print / Save as PDF". Toolbar + selector vanish; the letterhead, status badge, requirements list, and disclaimer remain.

### Caveats (documented in the UI)

- Pawdex doesn't store chip-implant date — chip-before-rabies ordering is always flagged for vet confirmation.
- Titer detection is keyword-based on event text. False negatives are possible if the lab name isn't in the title or summary.
- The EU rules table is hard-coded; updating it is a code change (intentional — these are regulated rules, not user-configurable).

## Phase 6.3 — Expiration radar

Single consolidated view of every expiration-bearing record in the household, sorted by urgency. Lives at `/expiring` and replaces the previous Reminders top-nav slot.

- **Vaccinations** — latest per `(pet, vaccine_family)` so duplicates collapse. Surfaces expiry date, days-until, rabies "LEGAL" chip when applicable.
- **Insurance renewals** — every active `insurance_policies.renews_on`.
- **Grouped + colored** by urgency: Overdue (red), Due soon ≤ 14d (orange), Coming up ≤ 60d (amber), Further out (green).
- **No new schema** — pure aggregation. Implementation in [lib/db/expiring.ts](lib/db/expiring.ts).

Future kinds to surface here (TODO): USDA APHIS 7001 cert windows, microchip registry renewals, medication courses with hard end dates.

## Phase 6.4 — Quality-of-life tracker (HHHHHMM)

Daily quality-of-life journal for senior or end-of-life pets, modeled on the established HHHHHMM rubric (Hurt, Hunger, Hydration, Hygiene, Happiness, Mobility, More good days than bad). Each dimension scored 0–10. Lives at `/pets/[id]/quality-of-life`, accessible via the new **QoL** tab in the pet detail nav.

- **New schema:** `qol_entries` table with one row per `(pet, recorded_on)`. RLS scoped to household membership + write requires household-write role. Re-submitting the same day's entry upserts.
- **UI:** seven range sliders (default 7/10), notes field, daily total scored out of 70.
- **Trend chart:** recharts line of total score over time with a reference line at 35 ("Discuss with vet ≤ 35"). The 35 threshold is the established HHHHHMM convention — Pawdex displays it for context but never makes a recommendation.
- **Tone discipline:** the page header, the trend reference line, and the footer all carry the same disclaimer — *Pawdex never makes end-of-life decisions or recommendations from this data. Share the trend with your veterinarian.*

This is the only feature in Pawdex that comes within an arm's length of end-of-life territory; the boundary is enforced both in copy and in absence of any "recommended" surface. Owners who use it through end-of-life don't leave the product.

## Phase 6.6 — Boarding share-link

Tokenized read-only public URL for sending a pet's compliance packet to boarders, kennels, sitters, or any third party that doesn't have a Pawdex account.

- **New schema:** `share_links` table with `token_hash` (SHA-256 hex of the URL token — the raw token is shown to the user ONCE at creation), `expires_at`, `revoked_at`, `access_count`, `last_accessed_at`. RLS-scoped to household members on the management surface; the public `/share/[token]` route uses the service-role client and does its own expiry + revoke checks.
- **Token generation:** 24 random bytes via `node:crypto` randomBytes, base64url-encoded → 32-character URL-safe token. SHA-256 hash is what lands in the DB.
- **Management UI:** [SharePanel](app/(app)/pets/[petId]/packet/share-panel.tsx) lives at the bottom of the compliance packet page. Owners create a link with optional recipient label + TTL (3/7/14/30/60 days, default 14). After creation, the raw URL is shown once with a Copy button — Pawdex never displays it again. Active and past links are listed below with access count, last-accessed timestamp, and a Revoke button for active ones.
- **Public route:** [/share/[token]](app/share/[token]/page.tsx) renders the same content as the compliance packet but in a sandboxed surface — no top nav, no auth required, no edit affordances. Expired or revoked tokens render a friendly "this link is no longer valid" page instead of the records.
- **Security boundary:** the raw token is in the URL — anyone with the URL gets the packet for the TTL window. Owners revoke when the trip ends. Audit log records every link create + revoke; the table itself tracks every access.

## Phase 6.7 — Offline emergency card

Wallet-sized printable ID card with everything a first responder, boarder, or stranger-who-finds-your-lost-pet needs to know. Lives at `/pets/[id]/emergency-card`. Reuses the existing PrintButton + `@media print` discipline from the compliance packet.

- **Front of card:** pet photo, name (serif), breed/species, color/markings (when on file), microchip + registry, owner name + email.
- **Back of card:** primary emergency vet (name + phone), allergies (auto-detected from `medical_events.diagnosis` containing "allerg" / "anaphyl" / "hypersensitiv" keywords), active take-home medications (name + dose + frequency, up to 5), pet special-handling notes.
- **Print discipline:** front + back render side-by-side in a 2-column grid on screen so they fit on one sheet of paper. `@page` margins set to 12mm; cards are `page-break-inside: avoid`. Dotted border on screen + print gives the user a cut guide. Many users will also take a photo of both sides and set as a phone lock-screen wallpaper for first-responder access.
- **Pet header** gets a new **Emergency** button alongside **Briefing**, **Packet**, **EU travel**.

## Phase 6 rounds 4-6 — V1.5 completion + pre-prod hygiene

The remaining V1.5 menu items + Phase-5-deferred features + a full pre-prod hygiene sweep. Net: every V1.5 menu item from the plan is shipped, every deferred Phase 5 item is shipped, and the security/deploy/RLS posture is documented.

### Round 4 — V1.5 fills (6.9 – 6.13)

- **6.9 Email-forwarding setup help** — `/help/email-forwarding` walks users through Gmail / Outlook / iCloud / vet-portal forwarding rules pointing at their household inbox slug. Discoverable from `/inbox`.
- **6.10 Tier-2 LLM refinement for PEC matches** — "Refine with AI" button on `/insurance` flagger panel routes to `/insurance/[id]/pec-analysis`, where Flash classifies each (event, exclusion) heuristic match as `match` / `ambiguous` / `false_positive` with a one-sentence rationale.
- **6.11 Breed risk profile** — curated AAHA / AAFP / consensus-group screening windows in [lib/clinical/breed-risk.ts](lib/clinical/breed-risk.ts) for 10+ breeds. `/pets/[id]/breed-risk` (new **Risk** tab) groups screenings into Due Now / Within a Year / Later in Life based on pet age. Universal life-stage screenings layer underneath the breed-specific ones.
- **6.12 Multi-medication scheduler** — new `medication_administrations` table. `/pets/[id]/medications` gets a "Today's doses" panel above the table with a "Mark given" checkbox per active take-home Rx. Each click logs a row; "Log another" supports multiple doses per day.
- **6.13 Rx pharmacy shopper** — owner-curated price comparison. New `medication_price_quotes` table + `pharmacy_source` enum (Chewy / Costco / GoodRx / 1-800-PetMeds / Walmart / Vet / Other). `/pets/[id]/medications/[medId]/prices` ranks quotes by price, computes potential savings vs the most expensive listed source.

### Round 5 — claims + lab trends + packet variants (6.14 – 6.18)

- **6.14 Claims workflow + appeal assistance** — new `claims` + `claim_attachments` tables with `claim_status` enum (drafted / submitted / approved / partially_approved / denied / appealed / closed). `/insurance/[id]/claims` lists every claim with status pills + YTD reimbursed total. Per-claim detail page lets you record submission, claim number, approved/reimbursed amounts, denial reason. Denied claims surface a "Draft appeal email" CTA that routes to the existing `/insurance/[id]/clarify` flow.
- **6.15 YTD-claims tracking + smarter OOP defaults** — [lib/db/policy-ytd.ts](lib/db/policy-ytd.ts) computes per-policy-year approved + reimbursed totals from the `claims` table. `/insurance/[id]/estimate` auto-populates "deductible remaining" and caps `annual_max_remaining` at `annual_max − YTD reimbursed`. Policy year anniversary derives from `effective_on`, falls back to calendar year.
- **6.16 USDA APHIS 7001 worksheet** — `/pets/[id]/packet/aphis-7001` produces a print-ready prefilled worksheet for the USDA-accredited vet to use when issuing the international health certificate. Includes signature lines for vet + USDA APHIS endorsement. EU pet passport variant reuses the existing `/eu-travel` page. Both are linked from the main compliance packet.
- **6.17 Vet-quote round-trip for OOP** — "Email your vet for an estimate" form on `/insurance/[id]/estimate`. Sends a templated quote-request to a clinic with email on file under the `records_request_to_vets` authorization. Reply lands in the household inbox. A `cost_estimates` row in `pending_vet_response` status tracks the request.
- **6.18 Longitudinal lab trend detection** — new `lab_values` table for structured per-analyte rows. `/pets/[id]/labs` (new **Labs** tab) groups values by analyte, renders a recharts line per analyte with the reference range as a shaded band, flags out-of-range values in red. Auto-flag (H/L) computed when user provides reference low + high.

### Round 6 — pre-prod hygiene (6.19 – 6.21)

- **6.19 RLS smoke test refresh** — [scripts/check-rls.ts](scripts/check-rls.ts) now audits all 30 household-scoped tables. Running it against the live DB confirms anon role fails closed on every one. The test fails the build if any new table is added without RLS coverage.
- **6.20 Env audit + deploy checklist** — [DEPLOY.md](DEPLOY.md) catalogs every env var across `.env.local`, Supabase Vault, Supabase Edge Function secrets, and Vercel project env. Step-by-step runbook from DNS through cron schedules through pre-launch verification. Section 10 calls out the deploy mistakes Pawdex specifically trips on (CRON_SECRET 3-way mismatch, missing inbound MX record, dev-mode webhook fallback in prod).
- **6.21 Security review** — [SECURITY.md](SECURITY.md) full threat model + audit. **Findings:** RLS coverage clean across 30 tables; service-role isolation verified in all 4 route handlers; share-link entropy at 192 bits + hashed at rest; HMAC discipline on every signed URL; authorization-before-outbound enforced at DB layer via `outbound_emails.authorization_id NOT NULL`. **Applied hardenings:** `NODE_ENV === "production"` gate on the three webhook routes so a missing-secret deploy fails closed; defensive `auth.uid()`-based household membership check inside the `match_extraction_chunks` RPC; `lib/ai/qa.ts` switched from service-role to auth-bearing server client.

### Final route count

50 routes total. Up from 38 at end of Phase 6 round 3.

## Phase 6.24–6.28 — Prompt v6 + multi-format ingestion + dedup

Major upgrade to the extraction pipeline driven by two real-world test documents (a 16-page Hillcrest PIMS chart + a Cleveland Park SOAP export). Both surface formats that prompt v5 didn't handle well, and both raise the dedup question Pawdex's commit pipeline previously ignored.

### 6.24 — Prompt v6 + schema additions

[lib/ai/prompts/v1.ts](lib/ai/prompts/v1.ts) — full rewrite at `v6.0.0` with explicit guidance for:

- **PIMS aggregated chart format** (Cornerstone / AVImark / eVetPractice). One section per visit date. PIMS codes ignored unless they help disambiguate row type.
- **True SOAP block format** with `S -` / `O -` / `A -` / `P -` prefixes. One section per SOAP block, content mapped to summary/diagnosis/treatment fields.
- **Anesthesia roll-up rule** — Propofol/Isoflurane/Ketamine and "Anesthesia monitoring" / "Isoflurane 45 min" all belong to the surgery event, NOT separate medical_events.
- **Boilerplate education filter** — "Heartworm Prevention" / "Spay/Neuter" / "Dietary Needs" template paragraphs tagged in `excluded_boilerplate[]`, not emitted as medical_events.
- **Cross-clinic attribution** — when "PREVIOUS VET RECORDS SCAN" cue appears, older entries get the prior clinic's `clinic_name`.
- **Clinic name inference** from URLs / phone numbers / provider sign-offs when no letterhead present.
- **Vaccine family normalization table** — explicit mapping so "Distemper DALPP" / "DHPP" / "DAPPv" all → `family = dhpp`. Same for rabies / lepto / bordetella / CIV variants.
- **Impossible-date sanity check** — flag dates more than 30 days before the visit's own date or more than 2 years in the future.
- **Vital signs roll-up** — T/HR/Resp/BCS into the visit summary one-liner, not separate events.

[lib/ai/extraction-schema.ts](lib/ai/extraction-schema.ts) — four new top-level arrays:

- **`lab_values[]`** — structured per-analyte rows feeding the lab_values table → trend charts.
- **`upcoming_reminders[]`** — forward-looking reminders extracted from "Reminders for {pet}" blocks.
- **`pet_attributes`** — what the document claims about pet identity (breed, DOB, microchip, sex, color).
- **`excluded_boilerplate[]`** — patient-education blocks the model filtered, surfaced for transparency.

### 6.25 — Commit-pipeline dedup helpers

[lib/db/extraction-dedup.ts](lib/db/extraction-dedup.ts):

- **`findCandidateDuplicateVaccines`** — family-aware match (or type substring fallback) within ±3 day window. Catches "Rabies sq right hip" from Cleveland Park colliding with "Canine Rabies Annual Vaccine" from Hillcrest's import of the same shot.
- **`findCandidateDuplicateMedicalEvents`** — title token-overlap match (≥2 non-stopword tokens) within ±1 day window.
- **`findCandidateDuplicateMedications`** — normalized drug-name match within ±3 day window. Strips parenthetical doses and route abbreviations.
- **`reconcilePetAttributes`** — diffs extracted pet attributes against the canonical pets row.

Helpers are advisory — they return candidate matches; Pawdex never auto-merges in v1. Review UI surfaces decisions back to the user.

### 6.26 — Lab values + reminders + pet attributes persistence

`commitExtraction` extended to write:

- Lab values from `input.lab_values[]` → `lab_values` table with computed H/L flags.
- Upcoming reminders from `input.upcoming_reminders[]` → `reminders` table with `(entity_type, entity_id, lead_days)` uniqueness — re-running commit doesn't duplicate.
- Pet attribute accepts from `input.pet_attribute_updates` → canonical `pets` row + audit log entry.

### 6.27 — Review UI extensions

[review-extensions.tsx](app/(app)/pets/[petId]/documents/[docId]/review/review-extensions.tsx) — single client component rendered above entity cards on `/review`. Four panels:

- **Pet attribute reconciliation banner** — per-field accept pills when the document's claims diverge from the current pet record.
- **Upcoming reminders panel** — checkbox-toggleable list of forward-looking due dates.
- **Lab values panel** — per-analyte table with skip toggles. Feeds the trend charts when committed.
- **Excluded boilerplate disclosure** — collapsed list showing what template education was filtered.

### 6.28 — Verification

Type-check + production build both clean. Both Finn test PDFs (Hillcrest 16-page aggregated chart + Cleveland Park 3-visit SOAP) will exercise different code paths of the new prompt + schema. Re-extraction against the prompt v6 changes is the validation step.

### Known gap deferred

**Inline conflict pills on entity cards** — the dedup helpers exist + return candidates, but the review form's existing entity cards (vaccinations, medications, medical_events) don't yet render a per-card "⚠ already in your records" warning. The conflict candidates are computed; rendering them inline next to each card is the next polish round.

## Phase 6.29 — Document deletion + Finn doc wipe

[lib/db/document-delete.ts](lib/db/document-delete.ts) — single helper that hard-deletes a `documents` row and every extraction artifact attached to it (extraction rows, embedding chunks, audit-log entries) while preserving committed entities by nulling `document_id` on `vaccinations` / `medical_events` / `medications` / `weight_log` rows. Storage object is deleted via the Supabase Storage API (direct DELETE on `storage.objects` is blocked by `protect_delete`).

UI: `<DeleteDocumentButton>` ([delete-document-button.tsx](app/(app)/pets/[petId]/documents/[docId]/delete-document-button.tsx)) appears in three places — the document viewer header (primary CTA), the gallery card footer (ghost variant), and the inbox row. Confirm-dialog before destruction. Server action `deleteDocumentAction` in [upload/actions.ts](app/(app)/pets/[petId]/upload/actions.ts) handles inbox case (empty petId) so unassigned-document deletes work too.

## Phase 6.40 — Repo hygiene, migration recovery, CIV family fix, labs/weights dedup, citations

Audit-driven cleanup pass converting "impressive working tree" into "recoverable, reproducible project," plus the remaining tracked deliverables.

**Repo hygiene.**
- The entire platform (154 files, months of work) sat on a single Create-Next-App commit. Now committed in 5 logical chunks (db / lib / ui / app / ops) + follow-up fix commits. Working tree clean.
- **Migration recovery:** `supabase/migrations/` had 0001–0003 while the live DB carried 23 applied migrations (evolved via MCP during development — schema drift meant a fresh environment couldn't be reproduced). All 20 missing files recovered from `supabase_migrations.schema_migrations`; a background agent verified 0006–0023 **byte-for-byte via md5** against the DB.
- **`types.gen.ts` generated-column lie fixed:** `vaccine_family` is `GENERATED ALWAYS AS (vaccine_family_of(vaccine_type))` in Postgres, but the hand-authored types still allowed it in Insert/Update — TypeScript would permit writes Postgres rejects at runtime. Removed.
- **Env naming fixed:** `.env.local` used `OPENROUTER_MODEL_DEFAULT/PREMIUM`; the code reads `OPENROUTER_MODEL_TIER1/2/3`, so env settings were silently ignored. Correctly-named vars appended.
- **`pnpm test` / `pnpm check`:** all four behavioral suites (extraction dedup, PIMS, Form 51, PEC) now run behind one script; `check` gates tsc + tests — the CI foundation.

**CIV family bug (found while recovering migration 0005).** Two independent family-inference implementations exist: SQL `vaccine_family_of()` (stamps stored rows via the generated column) and TS `inferFamilyFromType` (labels extraction candidates). They diverge on canine influenza — SQL emits `'canine_influenza'`, TS emits `'civ'` — so the dedup family-match silently failed for every CIV vaccine. Fixed with a `canonicalFamily()` alias map in the pure matcher applied to **both** sides before compare, plus regression test S17 (type strings share no substring, so only family-match can link them — same shape as the rabies S16 case).

**Labs + weights dedup (Phase 6.39 item, now done).** Deliberately two-tier and conservative: same-day weight within 0.05 kg → `exact` (default-skip); divergent same-day reading → `loose` only (a re-measurement must stay visible). Same analyte + collection date + equal value → `exact`; same analyte/date with a **different** value → `loose` only — that can be a corrected/amended result and pre-skipping would hide the correction. Wired compute → surface (weight `ConflictBanner`, lab "on file" pill in ReviewExtensions) → commit. Behavioral suite grew to **55 assertions** (S17–S21), all passing.

**Citations rendered (Phase 6.36 item, display half).** Every entity card on `/review` now shows the v6.1 `source_quote` + `source_page` the model grounded the row in — dashed-border footer, 2-line clamp, full quote on hover, null-safe for pre-v6.1 extractions. Click-to-highlight in the PDF viewer remains future work.

**Still open after this pass:** PIMS/Form51/PEC runtime wiring (needs the text pre-pass), receipts/expenses design (awaiting approach approval), end-to-end real-document validation, Phase 7 monetization.

## Phase 6.38 — Ingestion dedup: making "don't re-ingest" actually work

The platform's core requirement is that scanning a document understands what's in it AND recognizes what we already have so it isn't ingested twice. An audit found this was largely **built but not wired**:

- **File-level dedup (content_hash)** was wired for insurance uploads only — the main vet-document path never populated or checked the hash. Re-upload the same PDF, get two documents + two extractions.
- **Entity-level dedup** (`findCandidateDuplicateVaccines / MedicalEvents / Medications`) was **dead code** — zero callers. The commit path blindly inserted rows. Upload a cumulative history after a single-visit note → duplicates.
- The **PIMS / Form 51 / PEC helpers** (Phase 6.32–6.35) are still unwired — deferred again here because they take `textSample: string` but the pipeline sends raw bytes to the vision model. Wiring them needs a text pre-pass (digital-PDF text-layer or an OCR call) that doesn't exist yet. Tracked separately.

### What shipped

**File-level dedup on the main upload** ([upload/actions.ts](app/(app)/pets/[petId]/upload/actions.ts) + [document-uploader.tsx](components/pawdex/document-uploader.tsx)). `createDocument` already downloads the bytes for HEIC/encryption preprocessing — it now hashes those **original** (pre-conversion) bytes, checks `findDocumentByHash` before inserting, and on a hit returns a `{ duplicate: true }` variant that skips both the insert and extraction. The client renders a neutral "Already saved" pill + a "View existing" link instead of an error. The `23505` unique-violation race is caught and re-queried. (Image dedup is best-effort — client compression re-encodes non-HEIC images so they aren't byte-stable; PDFs + HEICs are reliable, which is the case that matters.)

**Entity-level dedup, wired end to end with default-skip-but-visible:**

- **Pure matchers extracted** to [lib/db/extraction-dedup-match.ts](lib/db/extraction-dedup-match.ts) — no DB, no I/O, unit-testable. Each match carries a `match_strength` (`exact` / `strong` / `loose`). The DB finders in [extraction-dedup.ts](lib/db/extraction-dedup.ts) now fetch existing rows + clinic names and delegate to the pure matchers.
- **Compute** ([review/page.tsx](app/(app)/pets/[petId]/documents/[docId]/review/page.tsx)) — for each extracted vaccine/event/med, find existing rows on the pet that look like the same record. Candidate index aligns 1:1 with the form's draft arrays. Maps are `Object.fromEntries`'d across the RSC boundary.
- **Surface** ([review-form.tsx](app/(app)/pets/[petId]/documents/[docId]/review/review-form.tsx)) — high-confidence matches **default the skip toggle ON** so the user doesn't re-ingest records already on file. But the row stays fully rendered with a `<ConflictBanner>` ("Already on file: Rabies · given 2025-01-09 · same day") and an overridable Include checkbox. A grouped summary banner reports "N records look like things already in your records — skipped by default." This is the advisor's key safety call: **never silent auto-skip on medical data** — a false-positive that vanishes a real dose is worse than a duplicate.
- **Commit** ([review/actions.ts](app/(app)/pets/[petId]/documents/[docId]/review/actions.ts)) already filters `!skip` before inserting, so default-skip + override flow through correctly with no new commit logic.

### The bug behavioral verification caught

A parallel verifier wrote [scripts/test-extraction-dedup.ts](scripts/test-extraction-dedup.ts) — 15 scenarios / 43 assertions against the pure matchers with synthetic known-overlap fixtures (including the real Hillcrest-rabies-vs-Cleveland-Park-rabies case and a 10-candidate cumulative-history scale test). It found a **silent-loss bug `tsc` could never catch**: `normalizeMedName` stripped dose *forms* ("tablet") but not numeric *strengths* ("16mg"), so `"Apoquel (oclacitinib) 16mg tablet"` normalized to `"apoquel 16mg"` and never matched an existing `"Apoquel"`. Vet PIMS exports routinely embed strength in the drug name, so this would have silently re-ingested duplicate medications on a large fraction of real records — the exact failure mode this work targets. Fixed by stripping dose strengths (decimal-aware, before punctuation collapse). All 43 assertions now pass.

A second parallel verifier reviewed the wired flow for correctness — index alignment (guaranteed by passing the same array object to both candidate-build and draft-build, no `.filter()` on either side), no silent-loss path (default-skip only dims the row, never removes it from the rendered list), override-reaches-insert, and serialization across the RSC boundary. SHIP verdict on all six checks. Its one caveat — a **dateless** medication name-match was being marked `exact` (most aggressive default-skip) even without a date to confirm it's the same course vs. a new one — was fixed: dateless matches are now `loose` (surfaced with a banner but never pre-skipped), so a genuinely-new course of a known drug is never silently hidden when the document omits the start date.

**The asymmetry both verifiers missed (caught on the final advisor pass).** The vaccine matcher inferred family on the *candidate* (`inferFamilyFromType` in page.tsx) but read `vaccine_family` raw on the *existing* DB row — and the commit path never populated that column, so every extraction-committed row had `vaccine_family = null`. The behavioral test hid this by hand-populating family symmetrically on both sides. The consequence was load-bearing: the motivating case — Hillcrest "Canine Rabies Annual Vaccine" already on file vs. Cleveland Park "Rabies sq right hip" newly extracted — has no shared substring, so *only* family-match can link them, and family-match needs both sides resolved. With the existing side null, the cross-clinic re-wording silently re-ingested. Fixed two ways: (1) the finder now infers family on the existing side too (`r.vaccine_family ?? inferFamilyFromType(r.vaccine_type)`), which rescues all legacy + previously-committed null-family rows immediately; (2) the commit path now persists `vaccine_family` on insert so future rows store it. Added test scenario S16 — the exact cross-clinic null-family case — asserting an `exact` high-confidence match. 16 scenarios / 46 assertions, all passing.

### Deferred (tracked, not lost)

- PIMS / Form 51 / PEC runtime wiring (needs the text pre-pass) — Phase 6.39.
- lab_values / weights dedup — the matchers cover vaccines/events/meds; labs + weights also duplicate on re-ingest. Lower stakes — Phase 6.39.

## Phase 6.37 — Breed risk pulled pending editorial process

The Risk tab is removed from `pet-tabs.tsx` and `/breed-risk/page.tsx` now renders a "feature paused" notice. The v1 dataset in [`lib/clinical/breed-risk.ts`](lib/clinical/breed-risk.ts) stays in the repo for future restoration — pulling, not deleting, so the curation work isn't lost.

**Why pulled.** The v1 covered ~10 breeds × 2-4 screenings — too narrow to be genuinely useful, and "this might happen to your pet" claims without a clinician reviewer have asymmetric legal exposure (small upside, catastrophic downside).

**Re-enable criteria** (documented in `pet-tabs.tsx`):

1. Reviewer-gated content workflow — someone with veterinary credentials approves each claim before it ships.
2. Canonical matrix of ≥70 breeds × ≥10 conditions (~700 cells from AAHA Lifestage + OFA + AKC breed-club statements).
3. Per-claim source citations rendered in the UI (PMID for papers, AAHA section for guidelines, OFA URL for stats).
4. Liability framing reviewed by counsel before launch.

**Architecture sketch for the eventual rebuild** (preserved here so it's not re-derived later): a layered L0–L4 stack — hand-curated canonical matrix as ground truth, authoritative source ingestion (AAHA / OFA / AKC / VetCompass), insurance claim partner data, narrow PubMed RSS pipeline that feeds a `breed_risk_candidates` review queue (never auto-promotes), and user-flagged corrections. The PubMed pipeline reuses ~80% of Pawdex's existing extraction infrastructure (Sonnet Tier-3 + staged review). The data isn't actually a firehose — ~5-20 new breed-association papers/month globally, quarterly review cadence is sufficient.

## Phase 6.32–6.35 — Ingestion deep-dive: research + Tier 1 + Tier 2 + helpers

Four parallel research agents spent ~7 minutes each surveying 2026 best practices for PDF/image vision-LLM extraction, vet-record specifics, and insurance-policy extraction. The synthesis (see commit notes) ranks 16 recommendations by ROI; this round ships every Tier 1 fix, the Tier 2 schema foundation, and the Tier 3 helper modules (PIMS + Form 51 + PEC pre-filter). UI integration of citations + helper wiring into runtime are deferred to a follow-up.

### Tier 1 — Preprocessing + escalation hardening (shipped)

- **HEIC → JPEG conversion** in [`lib/ingest/preprocess.ts`](lib/ingest/preprocess.ts) via `heic-convert` (pure-JS, no native deps). Wired into [`createDocument`](app/(app)/pets/[petId]/upload/actions.ts) — downloads the just-uploaded bytes, converts, rewrites the storage object as JPEG, and renames the original filename. Fixes iPhone HEIC pass-through that silently failed once Tier 3 escalated to OpenAI.
- **Encrypted PDF detection** in the same preprocessor via `pdf-lib` — `PDFDocument.load(bytes, { ignoreEncryption: true })` then read `isEncrypted`. Encrypted PDFs are rejected upfront with a clear "remove the password and re-upload" message, avoiding the [Claude conversation-poisoning bug](https://github.com/anthropics/claude-code/issues/25202).
- **Per-provider size caps** enforced in [`extraction-trigger.ts`](lib/ai/extraction-trigger.ts) before routing: 50 MB Gemini inline, 32 MB Claude PDF, 5 MB Claude API image. Over-Gemini → `markFailed` upfront; over-Claude → `console.warn` and proceed (Tier 1/2 may still succeed). No more silent 400s mid-ladder.
- **Zod-aware tier escalation** in [`extract-document.ts`](lib/ai/extract-document.ts). `runTier` now accepts a `priorFailureHint` param; the loop captures the failure reason and threads it into the next tier's user message as `"IMPORTANT: A previous extraction attempt by a smaller model failed because…"`. Helper `summarizeFailureForNextTier()` distils Zod / confidence-floor failures (actionable) while suppressing provider/network noise (not actionable).
- **Cap retries at 1 per tier** — was already the case; documented for clarity.

### Tier 2 — Schema foundation (shipped)

- **Per-row citations** — every leaf row in [`extraction-schema.ts`](lib/ai/extraction-schema.ts) (vaccinations, medications, medical_events, weights, lab_values) now carries `source_page` + `source_quote`. The prompt v6.1.0 instructs the model to leave fields null rather than fabricating when it can't quote them verbatim. Click-to-highlight UI in the review form is deferred — schema + prompt land first.
- **Lab `operator` enum** (`< | <= | = | >= | >` | null) on `labValueSchema`. Fixes the silent failure where IDEXX's `<20` was stored as just `20` — critically-low rounded to borderline-low.
- **Policy schema split** — [`policy-schema.ts`](lib/ai/policy-schema.ts) now has `{value, raw_text, source_page}` shape for premium/deductible/annual_max/reimbursement, plus enums `deductible_type` (`annual | per_incident | per_condition_lifetime` — Trupanion is the outlier) and `reimbursement_basis` (`invoice | schedule | usual_and_customary` — the difference between $800 and $300 on the same vet bill).
- **PEC clause classification** array on the policy schema: each PEC clause is tagged as `permanent | curable-with-waiting | bilateral-extension | symptom-only | lookback-window | definition | ambiguous`, with a `symptom_free_window_days` field for the Embrace/Fetch/Lemonade reinstatement pattern.
- **Per-category waiting periods** (`waiting_period_accident_days`, `_illness_days`, `_orthopedic_days`, `_cruciate_days`).
- **Defensive nulling** in [`extract-policy.ts`](lib/ai/extract-policy.ts) — drops any financial value where the LLM filled the number but skipped the citation. Unverifiable dollar figures shouldn't be persisted.
- **Prompt bumps** — [`prompts/v1.ts`](lib/ai/prompts/v1.ts) → `v6.1.0` (citations + lab operator), [`prompts/policy-v1.ts`](lib/ai/prompts/policy-v1.ts) → `policy-v1.1.0` (citations + deductible_type + reimbursement_basis + PEC classification + per-category waiting periods).

### Tier 3 — Helper modules (shipped, not yet wired into runtime)

Three pure-function helper modules, each built by a parallel sub-agent + verified by a parallel verifier sub-agent:

- **[`lib/ai/pims-classifier.ts`](lib/ai/pims-classifier.ts)** — fingerprints PIMS exports from text excerpts. Recognizes Cornerstone (IDEXX), AVImark (Covetrus), eVetPractice, ezyVet, plus generic `soap_export` and `unknown`. Each family ships with a `pimsPromptFragment(family)` that injects format-specific extraction guidance into the prompt. 7/7 test cases passing.
- **[`lib/ai/form51-anchor.ts`](lib/ai/form51-anchor.ts)** — NASPHV Form 51 rabies certificate detector. 9 signals (4 strong / 4 medium / 1 weak), threshold 0.3. Ships `PRODUCER_CODES` map (MER/ZOE/BIO/NOB/VAN/RAB/IMR/DEF/PUR/CON/ELA + Multiple/Unknown) and a `form51PromptFragment()` that anchors the LLM on the legally-significant fields (Tag # vs Serial #, 1Yr/3Yr/4Yr checkbox triad, struck-through Next-Due dates, M/D/YY date ambiguity). Positive cases hit conf 1.0; SOAP notes reject; weak-signals cases stay below threshold.
- **[`lib/insurance/pec-prefilter.ts`](lib/insurance/pec-prefilter.ts)** — scans policy text for PEC signal phrases (35+ regexes), returns categorized spans with character offsets. Tested on the sample text from the brief: 4 spans tagged (lookback-window / lookback-window / curable-with-waiting / bilateral-extension), critical false-positive guard holds. Ships `pecPromptFragment(spans)` that renders the guidance with explicit warning about the curable-condition reinstatement trap.

All three modules: pure functions, no I/O, full case-insensitive regex coverage, runnable test scripts in `scripts/test-{pims-classifier,form51-anchor,pec-prefilter}.ts`.

### Deferred to follow-up

- **Tier 2 #6 — click-to-highlight citation UI** on the review form (1,900-line file; schema + prompt land first, then UI in a separate pass).
- **Tier 3 wiring** — PIMS classifier needs a cheap pre-extraction text pass to feed it; Form 51 detector needs the same (or a post-Tier-1 re-route on extracted vaccine_certificate hits); PEC pre-filter needs the policy text accessible at extraction time. These are post-pipeline integration points to wire next.
- **Tier 4** — second-pass Haiku verifier on cited financial fields (needs the UI citations first), 2 few-shot examples in cached prefix, ensemble agreement for rabies dates / drug doses. Parking lot until live testing shows where the marginal gain lies.

## Phase 6.31 — Pet detail Overview redesign

Reference-driven rebuild of the per-pet screen (the most-loaded surface in the app). Three visible changes:

**1. Header stat strip.** Four uppercase-labelled cells appear below the meta line on every pet page — `WEIGHT` (current + ↗/↘ delta vs prior reading), `LAST VISIT` (most recent medical event date + "n days ago"), `NEXT DUE` (soonest non-overdue vaccine + "In n days", coloured by urgency ≤ 30d), `MICROCHIP` (number + one-click copy button + registry). Each cell self-suppresses when its data isn't on file — sparse pets render whatever signal exists without holes. The meta line itself now resolves the primary vet from the latest medical event's `vet_clinic_id` instead of leaving the field blank.

**2. Action consolidation.** Replaced the six-button row (Upload / Briefing / Packet / EU travel / Emergency / Edit) with three controls: `Upload`, `Export record` (→ `/packet`), and a `⋯` overflow menu housing Pre-visit briefing, EU travel readiness, Emergency ID card, and Edit. Overflow is a Radix `DropdownMenu` so keyboard nav + focus return work for free. Implementation: [`pet-actions-menu.tsx`](app/(app)/pets/[petId]/pet-actions-menu.tsx) + [`microchip-copy.tsx`](app/(app)/pets/[petId]/microchip-copy.tsx).

**3. Overview body — full rewrite.** Two-column layout above 980px, single column below:

- **Three KPI cards** (left top): Vaccines (`6 of 7 current` / next expiry), Medications (`2 active` / sample names), Labs (`All within range` / last panel date — flips to `N flagged` + analyte list when H/L readings exist). Each card links to its tab. Tone (`ok` / `warn` / `muted`) drives headline colour.
- **Recent medical events timeline** (left bottom): vertical rail with hollow dots, six newest events as cards with date pill + event-type chip + title + clinic name + optional summary + source-document chip linking back to the viewer. Subtitle reads "Pulled from N documents" when any exist.
- **Right rail (980 px+)**: `Next up` — scheduled reminders with `MMM dd` calendar-style date chips and overdue/due/upcoming colour cues, vaccine entity IDs resolved to readable names ("Rabies booster" not a UUID). `Key labs` — latest reading per analyte (top 4), each row showing analyte + reference range + inline SVG sparkline (no recharts — a 60×20 px `<polyline>`) + value, abnormal flagged values rendered in the overdue colour.

**Empty-state hygiene.** Every panel has a coherent zero-data branch — no vaccinations → "No vaccines yet / Add or upload a vaccine cert", no events → dashed-border empty card, no reminders → "No upcoming reminders.", no labs → "No lab values logged yet." The references were max-populated demo data; the live experience for a freshly-imported pet looks intentional, not broken.

**Files touched.** [layout.tsx](app/(app)/pets/[petId]/layout.tsx) (header rewrite + stat-strip data queries), [page.tsx](app/(app)/pets/[petId]/page.tsx) (full Overview rebuild), [pet-actions-menu.tsx](app/(app)/pets/[petId]/pet-actions-menu.tsx) + [microchip-copy.tsx](app/(app)/pets/[petId]/microchip-copy.tsx) (new client islands). `pet-tabs.tsx` untouched — already had `Overview` as the first tab with count plumbing.

## Phase 6.30 — Vaccine duration catalog + inferred expiry

[lib/clinical/vaccine-catalog.ts](lib/clinical/vaccine-catalog.ts) — single source of truth for "when does this vaccine expire" math. 10 families (rabies, dhpp, leptospirosis, bordetella, civ, lyme, rattlesnake, fvrcp, felv, fiv) with default + alt durations, first-dose-is-1-year rules, and a `legally_sensitive` flag for state-law-controlled vaccines (rabies). Sources: 2022 AAHA Canine Vaccination Guidelines, 2020 AAFP Feline Vaccination Guidelines, CDC rabies model.

Helpers:

- `inferFamilyFromType(vaccineType)` — regex-based free-text → family inference for legacy rows without `vaccine_family` populated.
- `computeExpiryFromFamily({ family, administered_on, pet_date_of_birth?, firstDoseHint? })` — returns `{ expires_on, duration_months, is_first_dose, source, rationale, legally_sensitive }`. First-dose heuristic: pet under 18 months on rabies/DHPP/FVRCP → fall back to 1 year regardless of family default.

Wired into three places:

- **Manual entry** — [vaccines/vaccination-dialog.tsx](app/(app)/pets/[petId]/vaccines/vaccination-dialog.tsx) watches `vaccine_type` + `administered_on`. When Expires is blank and the type maps to a known family, shows an inline hint like `Catalog default: 2029-05-26 (36 mo, first dose) [Use this]` with a `VERIFY STATE LAW` pill on rabies. [vaccines/actions.ts](app/(app)/pets/[petId]/vaccines/actions.ts) falls back to the catalog server-side when expiry is null, so even non-JS submissions get filled.
- **Extraction commit** — [review/actions.ts](app/(app)/pets/[petId]/documents/[docId]/review/actions.ts) fills `expires_on` from the catalog when the document didn't supply one (Hillcrest's PIMS chart frequently omits expiry).
- **Review UI** — `<ExpiryHint>` in [review-form.tsx](app/(app)/pets/[petId]/documents/[docId]/review/review-form.tsx) shows the same one-click suggestion inline below the per-vaccine card.

Reference: [/help/vaccines](app/(app)/help/vaccines/page.tsx) — public-facing table of every catalog entry grouped by species, plus an explanation of the first-dose heuristic and a state-law caveat box for rabies. Linked from the bottom of every pet's vaccines tab.

## Project layout

```
app/
  (app)/            # authenticated app (dashboard, pets, settings)
  login/            # magic-link auth
  auth/callback/    # Supabase OAuth callback
  onboarding/       # post-login household bootstrap
components/ui/      # shadcn primitives
components/         # shared product components (PetCard, etc.)
lib/
  auth/             # session + household resolver, post-login bootstrap
  db/               # typed query helpers
  schemas/          # Zod schemas + form↔payload converters
  supabase/         # server, browser, service-role clients + middleware
proxy.ts            # Next 16 Proxy (formerly middleware) — session refresh
supabase/migrations/
  0001_initial_schema.sql
  0002_rls_policies.sql
  0003_storage_policies.sql
scripts/
  check-rls.ts      # RLS smoke test
```

## Verification

After provisioning Supabase and applying the migrations:

```bash
# Type-check
pnpm exec tsc --noEmit

# Build
pnpm build

# RLS smoke test — anon role should see zero pets across households
pnpm dlx tsx scripts/check-rls.ts
```

## Roadmap

See the full architecture plan at `~/.claude/plans/i-want-to-create-immutable-diffie.md`. Phases:

1. ✅ Skeleton + manual data entry
2. ✅ Document ingestion + Gemini extraction
3. ✅ Reminders via Supabase Edge Functions + Resend
4. ✅ Polish (weight chart, household sharing, audit log, vet directory + merge tool)
5. 🚧 AI-native differentiators — rounds 1–4 shipped: authorizations, email-forwarding ingestion, manual + auto records-request, doc Q&A with pgvector, manual + AI-extracted insurance policies, compliance packet, pre-visit briefing, PEC flagger, true-OOP calculator, insurer clarification drafts. Still to come: vet-quote round-trip, YTD claims tracking, longitudinal lab trends, USDA APHIS / EU passport packet variants, claims workflow + appeal assistance.
6. ✅ V1.5 + pre-prod hygiene — every V1.5 menu item shipped (EU passport, expiration radar, QoL, boarding share-link, emergency card, multi-med scheduler, Rx pharmacy shopper, breed risk profile, forwarding-rule docs). Every deferred Phase 5 item shipped (Tier-2 PEC refinement, vet-quote round-trip, YTD claims, AI policy extraction, claims workflow + appeal assistance, USDA APHIS 7001 worksheet, longitudinal lab trends). RLS audit + deploy checklist + security review documented.
7. Monetization (Stripe via Vercel Marketplace)
