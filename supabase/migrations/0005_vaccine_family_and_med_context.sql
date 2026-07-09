-- Recovered from live migration history. Live version: 20260525044013

-- Pawdex Phase 2.7 — vaccine family normalization + medication context

-- ============================================================
-- Vaccine family — generated column groups all "Rabies (3 year)",
-- "rabies 1yr", "Rabies — 3 year" variants under a single family.
-- Used by getCurrentVaccinations to take latest-per-family.
-- ============================================================

create or replace function public.vaccine_family_of(vt text)
returns text
language sql
immutable
as $$
  select case
    when vt is null then null
    when lower(vt) like '%rabies%' then 'rabies'
    when lower(vt) like '%dhlpp%' or lower(vt) like '%da2pp%'
      or lower(vt) like '%dhpp%' or lower(vt) like '%dapp%' then 'dhpp'
    when lower(vt) like '%bordetella%' or lower(vt) like '%kennel cough%' then 'bordetella'
    when lower(vt) like '%lepto%' then 'leptospirosis'
    when lower(vt) like '%influenza%' or lower(vt) like '%civ%' then 'canine_influenza'
    when lower(vt) like '%lyme%' or lower(vt) like '%borrelia%' then 'lyme'
    when lower(vt) like '%rattlesnake%' then 'rattlesnake'
    when lower(vt) like '%fvrcp%' or lower(vt) like '%frcp%' then 'fvrcp'
    when lower(vt) like '%felv%' then 'felv'
    when lower(vt) like '%fiv%' then 'fiv'
    when lower(vt) like '%giardia%' then 'giardia'
    else lower(regexp_replace(vt, '[^a-z0-9]+', '_', 'gi'))
  end;
$$;

alter table public.vaccinations
  add column vaccine_family text generated always as (public.vaccine_family_of(vaccine_type)) stored;

create index idx_vaccinations_pet_family_admin
  on public.vaccinations(pet_id, vaccine_family, administered_on desc);

-- ============================================================
-- Medication context — distinguishes intraoperative meds (not
-- the user's responsibility to dose) from take-home prescriptions
-- (which actually become active medications).
-- ============================================================

create type medication_context as enum (
  'prescribed_takehome',
  'intraoperative',
  'injection_in_office',
  'otc_recommended',
  'unknown'
);

alter table public.medications
  add column medication_context medication_context not null default 'prescribed_takehome';

alter table public.medications
  add column duration_days int;

-- Partial index for the "active medications" query: only take-home meds
-- with no end date or future end date count.
create index idx_medications_pet_active_takehome
  on public.medications(pet_id, ended_on)
  where medication_context = 'prescribed_takehome';

-- ============================================================
-- vet_clinics.last_seen_at — denormalized "most recent activity"
-- timestamp for the /vets directory sort + display.
-- ============================================================

alter table public.vet_clinics
  add column last_seen_at timestamptz;

-- Seed last_seen_at for any existing clinics based on existing rows that
-- reference them (Phase 1 data).
update public.vet_clinics vc
set last_seen_at = sub.last_at
from (
  select vet_clinic_id, max(activity_at) as last_at from (
    select vet_clinic_id, administered_on::timestamptz as activity_at
      from public.vaccinations where vet_clinic_id is not null
    union all
    select vet_clinic_id, occurred_on::timestamptz from public.medical_events where vet_clinic_id is not null
    union all
    select vet_clinic_id, started_on::timestamptz from public.medications where vet_clinic_id is not null
  ) all_activity
  group by vet_clinic_id
) sub
where vc.id = sub.vet_clinic_id;

-- Trigger fn: bump last_seen_at on the vet_clinic whenever a vaccination,
-- medical_event, or medication is inserted/updated with a non-null vet_clinic_id.
create or replace function public.touch_vet_clinic_last_seen()
returns trigger
language plpgsql
as $$
declare
  evt_date timestamptz;
begin
  if (new.vet_clinic_id is null) then
    return new;
  end if;

  -- Use the relevant date field per source table.
  if tg_table_name = 'vaccinations' then
    evt_date := (new.administered_on)::timestamptz;
  elsif tg_table_name = 'medical_events' then
    evt_date := (new.occurred_on)::timestamptz;
  elsif tg_table_name = 'medications' then
    evt_date := (new.started_on)::timestamptz;
  else
    evt_date := now();
  end if;

  update public.vet_clinics
    set last_seen_at = greatest(coalesce(last_seen_at, evt_date), evt_date)
    where id = new.vet_clinic_id;

  return new;
end;
$$;

create trigger trg_vaccinations_touch_vet_clinic
  after insert or update of vet_clinic_id, administered_on on public.vaccinations
  for each row execute function public.touch_vet_clinic_last_seen();

create trigger trg_medical_events_touch_vet_clinic
  after insert or update of vet_clinic_id, occurred_on on public.medical_events
  for each row execute function public.touch_vet_clinic_last_seen();

create trigger trg_medications_touch_vet_clinic
  after insert or update of vet_clinic_id, started_on on public.medications
  for each row execute function public.touch_vet_clinic_last_seen();
