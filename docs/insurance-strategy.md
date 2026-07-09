# Pet Insurance Strategy

How puppy handles pet insurance: keeping policies up to date *and* surfacing better rates, without a live carrier API (because one doesn't exist).

---

## TL;DR

- **There is no consumer-facing "pull my policy" API** for any major pet insurer (Lemonade, Fetch, Trupanion, Healthy Paws, Embrace, ASPCA, Nationwide, Pets Best, Spot, MetLife, Figo, Pumpkin, Wagmo, Chewy CarePlus, Odie).
- **Canopy Connect** ("Plaid for insurance") exists — but covers only P&C (home, auto, commercial), not pet.
- **Pawlicy Advisor** is the dominant pet-insurance marketplace; affiliate model is the realistic "offer a better rate" path.
- Our approach: **carrier-agnostic policy record**, populated via **document upload + LLM extraction** as the magic path (manual entry as fallback), with **renewal-driven re-confirmation** to stay fresh and **affiliate quote comparison** for better rates.

---

## The Landscape (May 2026)

### What exists

| Provider | API | What it does | Useful to puppy? |
|---|---|---|---|
| Lemonade | Public quote/bind API | *Sell* renters/home/pet policies via partners | Affiliate only — no "pull existing policy" |
| Pets Best | Enrollment API | *Sell* new policies | Affiliate only |
| Odie | White-label partner API | Lets you resell as MGA | **Not for puppy** — becoming insurer-of-record triggers 50-state licensing, E&O, compliance, claims liability |
| Canopy Connect | Insurance data aggregator | P&C (home/auto/commercial) policy pull | **No pet support** |
| Pawlicy Advisor | Marketplace (not API-first) | Quote comparison across ASPCA, Hartville, Fetch, Pets Best, PetFirst | Affiliate referral |
| Fetch / Trupanion / Healthy Paws / Embrace / etc. | None public | Customer portals only | No |

### What doesn't exist

- A pet-insurance equivalent of Plaid or Canopy Connect
- Any carrier that exposes authenticated "read my policy" endpoints to third parties
- A standard schema for pet insurance policy data (every carrier formats their declarations differently)

### Why it doesn't exist

- Pet insurance is small relative to auto/home (~$4B vs. ~$400B US market)
- Carriers have no business incentive to expose policy data to third-party apps
- No regulatory pressure (no open-banking equivalent for insurance)

---

## Strategy: Carrier-Agnostic Record + Three Population Paths

### Core principle

We don't sync policies. We **store what the user gave us, mark when it was last verified, and nudge them to refresh at the right moments.** The data model is the same across every carrier.

### Population paths

1. **Document upload (primary "magic" UX)** — user uploads declarations page PDF or photo; LLM with vision extracts fields; user confirms.
2. **Manual entry (fallback)** — typed form for users without a doc handy.
3. **Email forwarding (phase 2)** — unique inbox per user; parse renewal/declarations emails automatically.

### What we explicitly *don't* do

- Store carrier portal credentials
- Run headless browsers to scrape carrier portals on the user's behalf
- Pretend the data is "live" — every record has `last_verified_at`

---

## Data Model

### Tables

```sql
-- Curated list of carriers we know about. Seed data.
create table insurance_carriers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- 'lemonade', 'fetch', 'trupanion', ...
  display_name text not null,
  website_url text not null,
  claim_portal_url text,
  affiliate_partner_id text,           -- our CJ/Impact/direct affiliate ID
  affiliate_link_template text,        -- deep link with our ref code
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per (pet, carrier) policy the user tells us about.
create table pet_insurance_policies (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  carrier_id uuid not null references insurance_carriers(id),
  household_id uuid not null references households(id) on delete cascade,

  policy_number text,                  -- user-provided, treat as opaque
  effective_date date,
  renewal_date date,                   -- drives our nudges

  annual_limit_cents bigint,           -- null = unlimited
  deductible_cents bigint,
  deductible_type text check (deductible_type in ('annual', 'per_condition', 'per_incident')),
  reimbursement_pct smallint,          -- 70 / 80 / 90, etc.

  covers_accident boolean not null default true,
  covers_illness boolean not null default true,
  covers_wellness boolean not null default false,
  covers_exam_fees boolean not null default false,
  covers_rx boolean not null default false,
  covers_dental boolean not null default false,
  covers_behavioral boolean not null default false,

  monthly_premium_cents integer,
  payment_method_label text,           -- 'Visa ••4242', no PCI data

  notes text,                          -- waiting periods, exclusions, anything carrier-specific

  source text not null check (source in ('manual', 'document_upload', 'email_parse', 'partner_api')),
  source_document_id uuid references insurance_documents(id),
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uploaded declarations pages, renewal letters, ID cards.
create table insurance_documents (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  policy_id uuid references pet_insurance_policies(id) on delete set null,

  storage_path text not null,          -- Supabase Storage
  mime_type text not null,
  file_size_bytes integer not null,
  doc_type text check (doc_type in ('declarations', 'renewal_letter', 'id_card', 'claim_eob', 'other')),

  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'processing', 'succeeded', 'failed', 'needs_review')),
  extracted_fields jsonb,              -- raw LLM output before user confirmation
  extraction_model text,               -- 'claude-opus-4-7', for reproducibility
  extraction_cost_usd numeric(10,4),
  extraction_error text,

  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
```

### RLS

Same household-scoping pattern used elsewhere in the app: policies and documents are readable/writable only by members of the owning household.

### Seed: carrier list (US, top ~15)

`lemonade`, `trupanion`, `fetch`, `healthy-paws`, `embrace`, `aspca`, `nationwide`, `spot`, `pets-best`, `metlife`, `figo`, `pumpkin`, `wagmo`, `chewy-careplus`, `odie`.

---

## Document Upload → LLM Extract Flow

### UX

1. User taps "Add policy" → "I have my declarations page" → file picker (PDF or photo).
2. Upload to Supabase Storage; insert `insurance_documents` row with `extraction_status = 'pending'`.
3. Server action fires background extraction (Vercel function with `maxDuration`).
4. UI shows a skeleton card; revalidates when `extraction_status` flips to `succeeded`.
5. Confirmation form: pre-filled with extracted fields, every field editable. User taps "Save policy."
6. We insert `pet_insurance_policies` row with `source = 'document_upload'`, link `source_document_id`.

### Extraction prompt shape

- Pass PDF/image to Claude with vision.
- Structured output (JSON schema matching the policy table columns).
- Include the seed carrier list so the model can normalize "ASPCA Pet Health Insurance" → `aspca`.
- Always include a `confidence` per field; fields with low confidence get a yellow "verify" badge in the confirmation form.
- Log model + cost to `insurance_documents.extraction_model` / `extraction_cost_usd` for unit-economics tracking (the Spark Analyzer pattern).

### Failure modes

- **Wrong document type** (claim EOB instead of declarations) → `extraction_status = 'needs_review'`, prompt user to upload a different doc.
- **Low-resolution photo** → succeed partial; mark fields with low confidence as required to confirm.
- **Unknown carrier** → store as `extraction_status = 'needs_review'`, ask user to pick from dropdown.

---

## Freshness Strategy

We never claim the policy is live. We do four things to keep it accurate:

1. **`last_verified_at` is always shown.** "Last updated 47 days ago" with a tap-to-refresh.
2. **Renewal nudges.** Push notifications at T-30, T-14, T-3 days before `renewal_date`: "Your [carrier] policy renews soon — confirm coverage hasn't changed." Tap → re-upload or quick-confirm flow.
3. **Annual silent verification.** If `last_verified_at` > 365 days, force a re-confirmation card in the dashboard.
4. **Email-forwarding inbox (phase 2).** Unique address per household → parse incoming carrier emails (renewal letters, premium changes, coverage updates) → flag policy for review.

---

## "Better Rate" Path

### Phase 1 — Affiliate referral (week 1, no API work)

- On policy detail page, render a "Could you save?" card.
- CTA → Pawlicy Advisor referral link with our affiliate code.
- Or carrier-specific affiliate deep links (Lemonade, Fetch, Trupanion via CJ/Impact).
- Track outbound clicks and conversion attribution.

### Phase 2 — In-app quote estimation (month 2–3)

- Collect breed, age, ZIP, desired coverage.
- Hit Lemonade quote API (only carrier with a real public quoting API).
- Show "Lemonade estimate: $X/mo" alongside current premium.
- For other carriers, show **published rate cards** (publicly available pricing data — refreshed quarterly).

### Phase 3 — Direct B2B integrations (year 1+)

- Sign affiliate/partner agreements with 3–5 carriers for richer quote APIs.
- Move from "estimate" to "real personalized quote."

### Not on the roadmap: becoming insurer-of-record

Earlier drafts of this doc listed "MGA / white-label partnership" as a future phase. **Removing it.** Becoming the insurer of record — even via white-label like Odie or Insurnest — carries risk that's wildly disproportionate to a consumer app's scope:

- **State-by-state producer licensing** in all 50 states (months of paperwork, surety bonds, CE, ongoing renewals; personal liability as a named licensee)
- **Mandatory E&O insurance** (~$3–10k/year minimum)
- **Insurance commissioner audits and market conduct exams** in every state we operate
- **Claims liability and brand exposure** when the back-end carrier mishandles a claim (we own the customer relationship, not the claim handling)
- **Customer service obligation** as first-line support for claims, cancellations, premium disputes (a full ops team, not a feature)
- **Per-state renewal/cancellation regulations** with regulatory action for violations
- **Insurance-specific privacy regime** (NAIC model + state insurance privacy acts, separate from general PII)
- **Potential underwriting loss-ratio risk-share** depending on the arrangement
- **Advertising compliance** on every quote and comparison page — state insurance advertising rules carry real fines

White-label MGA only pencils when the partner has millions of existing customers (Petco, Chewy) and existing legal/ops infrastructure to absorb the overhead. For puppy this would be **a different company, not a feature**. The affiliate model captures most of the economics with a tiny fraction of the risk.

---

## Roadmap

| Phase | Scope | Effort |
|---|---|---|
| **v1 (now)** | Schema + manual entry + document upload + LLM extraction + Pawlicy referral CTA | ~1–2 weeks |
| **v1.1** | Renewal nudges (push notifications), `last_verified_at` UI | ~3 days |
| **v2** | Email-forwarding inbox + auto-detection of renewal letters | ~1 week |
| **v2.1** | Lemonade quote API integration ("estimate" card) | ~3 days |
| **v3** | Direct carrier affiliate deals (Fetch, Trupanion, Embrace) | months of biz dev |
| ~~v4~~ | ~~White-label MGA~~ | **removed — see "Not on the roadmap"** |

---

## Open Questions

- Which carriers do we seed for v1? Recommend top 15 above; revisit based on user data after 3 months.
- Do we ever store the policy PDF after extraction succeeds, or delete it? Privacy vs. re-extraction. Default: keep in Storage, encrypted at rest, deletable by user.
- LLM extraction cost budget per policy? Estimate ~$0.02–0.05 with Claude Opus + vision. Spark Analyzer playbook: track per-extraction cost from day 1.
- Affiliate disclosure UX — required by FTC. Add "We may earn a commission" footnote on referral CTAs.
