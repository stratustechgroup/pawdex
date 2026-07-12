-- 0032_ingestion_v2.sql
--
-- Ingestion v2: capture invoice costs, and let short medication courses roll
-- off "Active" once their estimated end date passes.
--
-- Two changes, both additive (no backfill, no behavior change for existing
-- rows):
--
--   1) invoice_items — structured line items + amounts extracted from invoices
--      and itemized visit summaries. Nothing captured document costs before;
--      the extractor threw the whole billing block away. One row per line item.
--
--   2) medications.ended_estimated — a boolean marking that ended_on was
--      COMPUTED by Pawdex from a course duration (e.g. "x 7 days") rather than
--      stated verbatim on the document. The meds page treats a past estimated
--      end as inactive, but the UI can say "course likely finished (estimated)"
--      and offer a one-click "still taking it" correction. We never silently
--      expire a med the vet didn't explicitly end without this marker.
--
-- Deliberately NOT added: a separate `administration_context` column on
-- medications. The lead's brief proposed one ('in_clinic' | 'dispensed' |
-- 'unknown') to keep in-clinic drugs (anesthesia, one-off injections) out of
-- the active list. That distinction already exists at finer granularity in the
-- medication_context enum (migration 0005): intraoperative + injection_in_office
-- ARE the in-clinic cases, and app/(app)/pets/[petId]/medications/page.tsx
-- already filters "Active" to prescribed_takehome only. A second column would be
-- two sources of truth for one concept, and medication_administrations requires
-- a NOT NULL medication_id (migration 0018) so it cannot hold a standalone
-- in-clinic dose anyway. Problem #3 is handled by tightening the prompt and
-- exposing the existing context as an override toggle in review — no schema
-- change needed.

-- ── 1) invoice_items ────────────────────────────────────────────────

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- pet_id nullable: an invoice can predate pet assignment or cover a line the
  -- reviewer couldn't attribute to a specific pet. When known it's set.
  pet_id uuid references public.pets(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  -- Optional link to the clinical event this charge belongs to (the exam, the
  -- surgery). Left null in v1 commit; kept for the future spending<>event view.
  medical_event_id uuid references public.medical_events(id) on delete set null,
  description text not null,
  -- Stored in cents to avoid float drift. Extractor reads dollars; commit
  -- converts. Non-negative: discounts/credits are dropped at commit, not stored
  -- as negatives (the spending view sums charges, not net).
  amount_cents integer not null check (amount_cents >= 0),
  -- Coarse category guess for the future spending breakdown. Free-ish text but
  -- constrained to the extractor's vocabulary so the breakdown stays groupable.
  category text not null default 'other'
    check (category in ('exam', 'vaccine', 'medication', 'procedure', 'lab', 'other')),
  incurred_on date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- Spending queries are always "this pet, over time" — index for the YTD total
-- and the per-visit rollup.
create index invoice_items_pet_date_idx
  on public.invoice_items(pet_id, incurred_on desc);
create index invoice_items_document_idx
  on public.invoice_items(document_id);

alter table public.invoice_items enable row level security;

create policy "invoice_items_read"
  on public.invoice_items
  for select
  using (public.is_household_member(household_id));
create policy "invoice_items_write"
  on public.invoice_items
  for all
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

comment on table public.invoice_items is
  'Structured cost line items extracted from invoices / itemized visit summaries. amount_cents is per-line; the pet spending view sums by pet + period.';

-- ── 2) medications.ended_estimated ──────────────────────────────────

alter table public.medications
  add column ended_estimated boolean not null default false;

comment on column public.medications.ended_estimated is
  'True when ended_on was computed by Pawdex from a course duration (duration_days / total doses) rather than stated on the document. Drives the "course likely finished (estimated)" label and the "still taking it" override; a past estimated end counts as inactive.';
