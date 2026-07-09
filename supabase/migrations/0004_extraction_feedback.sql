-- Recovered from live migration history (version 20260523025436-era series).
-- Live version: 20260525042810

-- Pawdex — Phase 2.6: per-document extraction feedback for the learning loop.
-- Captures both explicit user rating + implicit value diff (what fields the
-- user changed before committing). Powers prompt + tier-routing improvements.

create type extraction_feedback_rating as enum (
  'great',
  'mostly_good',
  'many_errors',
  'unreadable',
  'wrong_doctype'
);

create table public.extraction_feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid not null references public.document_extractions(id) on delete cascade,
  rating extraction_feedback_rating not null,
  -- Standardized issue tags so we can aggregate across users. Free text in
  -- `issue_notes` captures anything the tags miss.
  issue_tags text[] not null default '{}',
  issue_notes text,
  -- value_diff is a structured object capturing which extracted values the
  -- user changed before committing. Shape: { vaccinations: [{ index, field, before, after }], medications: [...], ... }
  -- Used to mine implicit feedback (what does the model get wrong most often?).
  value_diff jsonb not null default '{}',
  -- Source-of-truth pointers so we can correlate feedback back to the prompt
  -- + model that produced the extraction.
  extraction_model text not null,
  extraction_prompt_version text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_extraction_feedback_household on public.extraction_feedback(household_id, created_at desc);
create index idx_extraction_feedback_document on public.extraction_feedback(document_id);
create index idx_extraction_feedback_model on public.extraction_feedback(extraction_model, extraction_prompt_version);

alter table public.extraction_feedback enable row level security;

create policy "extraction_feedback_select" on public.extraction_feedback
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "extraction_feedback_insert" on public.extraction_feedback
  for insert to authenticated
  with check (public.has_household_write(household_id));

create policy "extraction_feedback_update" on public.extraction_feedback
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));
