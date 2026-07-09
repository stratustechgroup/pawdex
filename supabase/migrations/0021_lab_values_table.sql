
-- Structured per-analyte lab values for longitudinal trend detection. Each
-- row = one analyte from one lab panel. Populated manually (Pawdex's
-- extraction returns lab values as freeform text today; the user enters
-- structured rows when they want trend tracking).

create table public.lab_values (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  medical_event_id uuid references public.medical_events(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  analyte text not null,
  value numeric not null,
  units text,
  reference_low numeric,
  reference_high numeric,
  flag text,                       -- 'H' / 'L' / 'normal' from the report itself
  collected_on date not null,
  lab text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index lab_values_pet_analyte_idx
  on public.lab_values(pet_id, lower(analyte), collected_on desc);

alter table public.lab_values enable row level security;

create policy "labs_read"
  on public.lab_values
  for select
  using (public.is_household_member(household_id));
create policy "labs_write"
  on public.lab_values
  for all
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

comment on table public.lab_values is
  'Structured per-analyte lab values for trend tracking. Pawdex flags out-of-range and surfaces multi-visit trends.';
