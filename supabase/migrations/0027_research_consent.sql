-- Pawdex Phase 6.41 — research consent foundations (expand phase).
--
-- Consent here models exactly ONE concern, kept deliberately separate from
-- personal-data handling (the Mars/Banfield split):
--
--   * Personally identifying information is NEVER shared. That is an invariant
--     of the product, not a toggle a user can flip. There is no table or column
--     here that grants PII sharing, and there never should be.
--   * De-identified AGGREGATE research participation is a distinct, explicit,
--     opt-in choice that is revocable going forward. That — and only that — is
--     what research_consents represents.
--
-- A consent opts specific animals (or the whole household) into de-identified
-- aggregate participation, backed by the existing immutable `authorizations`
-- consent primitive; dataset_releases records what actually shipped.

-- Extend the consent taxonomy. ADD VALUE is a standalone statement and the new
-- value is NOT referenced elsewhere in this migration (research_consents only
-- FKs authorizations by id), so there is no same-transaction use to trip over.
alter type authorization_type add value if not exists 'research_data_sharing';

-- =========================================================
-- research_consents — one row per household (optionally per animal) opting in.
-- Each hangs off an authorizations row so the exact consent text is frozen.
-- =========================================================

create table public.research_consents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- null animal_id = consent covers every animal in the household.
  animal_id uuid references public.animals(id) on delete cascade,
  authorization_id uuid not null references public.authorizations(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index idx_research_consents_household
  on public.research_consents(household_id, granted_at desc);
create index idx_research_consents_active
  on public.research_consents(household_id)
  where revoked_at is null;

comment on table public.research_consents is
  'Opt-in to DE-IDENTIFIED AGGREGATE research participation only. This never authorizes sharing personally identifying information — PII-never-shared is a product invariant, not represented here. revoked_at stops participation in future dataset_releases going forward.';

alter table public.research_consents enable row level security;

create policy "research_consents_select" on public.research_consents
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "research_consents_insert" on public.research_consents
  for insert to authenticated
  with check (public.has_household_write(household_id));

create policy "research_consents_update" on public.research_consents
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

-- =========================================================
-- dataset_releases / dataset_release_items — the audit trail of what actually
-- left the building. Service-role only: releases are assembled by a trusted
-- backend job, never by an end user, so no authenticated policies exist and
-- RLS fails closed for everyone but the service role.
-- =========================================================

create table public.dataset_releases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  released_at timestamptz,
  recipient text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.dataset_release_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.dataset_releases(id) on delete cascade,
  source_table text not null,
  source_row_id uuid not null,
  row_hash text,
  created_at timestamptz not null default now()
);

create index idx_dataset_release_items_release
  on public.dataset_release_items(release_id);

alter table public.dataset_releases enable row level security;
alter table public.dataset_release_items enable row level security;
-- No policies: service-role only.
