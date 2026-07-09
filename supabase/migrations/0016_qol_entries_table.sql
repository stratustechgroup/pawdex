
-- HHHHHMM quality-of-life journal. Each of 7 dimensions scored 0-10 by the
-- owner; total is computed in app (max 70). One entry per pet per day.
--
-- Pawdex never derives an end-of-life recommendation from these — the table
-- is a data tool, not a decision-maker. The UI carries that disclaimer.

create table public.qol_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  recorded_on date not null,
  hurt smallint not null check (hurt between 0 and 10),
  hunger smallint not null check (hunger between 0 and 10),
  hydration smallint not null check (hydration between 0 and 10),
  hygiene smallint not null check (hygiene between 0 and 10),
  happiness smallint not null check (happiness between 0 and 10),
  mobility smallint not null check (mobility between 0 and 10),
  more_good smallint not null check (more_good between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (pet_id, recorded_on)
);

create index qol_entries_pet_date_idx
  on public.qol_entries(pet_id, recorded_on desc);

alter table public.qol_entries enable row level security;

create policy "qol_read"
  on public.qol_entries
  for select
  using (public.is_household_member(household_id));

create policy "qol_insert"
  on public.qol_entries
  for insert
  with check (public.has_household_write(household_id));

create policy "qol_update"
  on public.qol_entries
  for update
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

create policy "qol_delete"
  on public.qol_entries
  for delete
  using (public.has_household_write(household_id));

comment on table public.qol_entries is
  'HHHHHMM quality-of-life journal for senior/EOL pets. Each dimension 0-10. Data tool only — Pawdex never recommends euthanasia from this data.';
