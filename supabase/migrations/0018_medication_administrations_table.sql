
-- Each row = one dose given (or marked-given) for a medication on a specific
-- date + time. Used by the daily med checklist on /pets/[id]/medications.
--
-- We don't model expected dosing schedules in the DB — the frequency field
-- on `medications` is free-text. The checklist treats every active
-- prescribed_takehome medication as having one dose-line per day and lets
-- the user check off when given. Future: structured schedule on medications.

create table public.medication_administrations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  administered_on date not null,
  administered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index medication_administrations_pet_date_idx
  on public.medication_administrations(pet_id, administered_on desc);
create index medication_administrations_med_idx
  on public.medication_administrations(medication_id);

alter table public.medication_administrations enable row level security;

create policy "medadmin_read"
  on public.medication_administrations
  for select
  using (public.is_household_member(household_id));

create policy "medadmin_insert"
  on public.medication_administrations
  for insert
  with check (public.has_household_write(household_id));

create policy "medadmin_delete"
  on public.medication_administrations
  for delete
  using (public.has_household_write(household_id));

comment on table public.medication_administrations is
  'Records when a dose was given (or marked given). Used by the daily med checklist on the pet detail page.';
