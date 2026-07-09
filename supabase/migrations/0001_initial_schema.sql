-- Pawdex — initial schema
-- Tables, enums, indexes, triggers. RLS lives in 0002.

-- =========================================================
-- Enums
-- =========================================================

create type pet_species as enum ('dog', 'cat', 'other');
create type pet_sex as enum ('male', 'female', 'unknown');
create type weight_source as enum ('manual', 'extracted', 'vet_visit');
create type medical_event_type as enum (
  'exam',
  'illness',
  'injury',
  'surgery',
  'dental',
  'lab_result',
  'imaging',
  'parasite_prevention',
  'behavioral',
  'other'
);
create type document_type as enum (
  'vaccine_certificate',
  'vet_visit_summary',
  'lab_result',
  'invoice',
  'prescription',
  'imaging',
  'adoption_record',
  'microchip_record',
  'other',
  'unknown'
);
create type processing_status as enum (
  'pending',
  'extracting',
  'extracted',
  'confirmed',
  'failed'
);
create type extraction_status as enum (
  'pending_review',
  'committed',
  'discarded'
);
create type household_role as enum ('owner', 'member', 'viewer');
create type reminder_status as enum ('scheduled', 'sent', 'failed', 'skipped');
create type reminder_channel as enum ('email', 'push', 'sms');

-- =========================================================
-- Updated-at trigger
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- households + members
-- =========================================================

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create trigger trg_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role household_role not null default 'member',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (household_id, user_id)
);

create index idx_household_members_user on public.household_members(user_id);

-- =========================================================
-- pets
-- =========================================================

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  species pet_species not null,
  breed text,
  sex pet_sex not null default 'unknown',
  altered boolean,
  date_of_birth date,
  dob_is_estimated boolean not null default false,
  color text,
  markings text,
  microchip_number text,
  microchip_registry text,
  current_weight_kg numeric(6, 3),
  photo_storage_path text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_pets_household on public.pets(household_id);
create index idx_pets_household_active on public.pets(household_id) where archived_at is null;

create trigger trg_pets_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- =========================================================
-- weight_log
-- =========================================================

create table public.weight_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  recorded_on date not null,
  weight_kg numeric(6, 3) not null,
  source weight_source not null default 'manual',
  document_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_weight_log_pet on public.weight_log(pet_id, recorded_on desc);

-- =========================================================
-- vet_clinics
-- =========================================================

create table public.vet_clinics (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  website text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uniq_vet_clinics_name_phone
  on public.vet_clinics (household_id, lower(name), coalesce(phone, ''));

create trigger trg_vet_clinics_updated_at
  before update on public.vet_clinics
  for each row execute function public.set_updated_at();

-- =========================================================
-- documents (declared early — FK targets from vaccinations etc.)
-- =========================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  storage_bucket text not null default 'documents',
  storage_path text not null,
  original_filename text,
  mime_type text,
  byte_size bigint,
  doc_type document_type not null default 'unknown',
  processing_status processing_status not null default 'pending',
  extraction_attempts int not null default 0,
  error_message text,
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz,
  confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index idx_documents_household_status on public.documents(household_id, processing_status);
create index idx_documents_pet_uploaded on public.documents(pet_id, uploaded_at desc);

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- =========================================================
-- document_extractions (staging)
-- =========================================================

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  extracted_at timestamptz not null default now(),
  model text not null,
  model_version text,
  prompt_version text not null,
  raw_response jsonb not null,
  confidence_overall numeric(3, 2),
  status extraction_status not null default 'pending_review',
  committed_at timestamptz,
  committed_by uuid references auth.users(id) on delete set null
);

create index idx_extractions_document on public.document_extractions(document_id);
create index idx_extractions_household_status on public.document_extractions(household_id, status);

-- =========================================================
-- vaccinations
-- =========================================================

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine_type text not null,
  administered_on date not null,
  expires_on date,
  lot_number text,
  manufacturer text,
  vet_clinic_id uuid references public.vet_clinics(id) on delete set null,
  administering_vet text,
  document_id uuid references public.documents(id) on delete set null,
  reminder_lead_days int[] not null default '{30,14,7,1}',
  is_rabies boolean generated always as (lower(vaccine_type) like '%rabies%') stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_vaccinations_pet_expires on public.vaccinations(pet_id, expires_on);
create index idx_vaccinations_household_expires on public.vaccinations(household_id, expires_on) where expires_on is not null;

create trigger trg_vaccinations_updated_at
  before update on public.vaccinations
  for each row execute function public.set_updated_at();

-- =========================================================
-- medical_events
-- =========================================================

create table public.medical_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  event_type medical_event_type not null,
  occurred_on date not null,
  title text not null,
  summary text,
  diagnosis text,
  treatment text,
  vet_clinic_id uuid references public.vet_clinics(id) on delete set null,
  attending_vet text,
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_medical_events_pet on public.medical_events(pet_id, occurred_on desc);

create trigger trg_medical_events_updated_at
  before update on public.medical_events
  for each row execute function public.set_updated_at();

-- =========================================================
-- medications
-- =========================================================

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  name text not null,
  generic_name text,
  dose text not null,
  route text,
  frequency text,
  started_on date not null,
  ended_on date,
  -- is_active is computed in the app, not stored — Postgres rejects generated
  -- columns referencing non-immutable functions like current_date.
  prescriber text,
  vet_clinic_id uuid references public.vet_clinics(id) on delete set null,
  indication text,
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_medications_pet_active on public.medications(pet_id) where ended_on is null;

create trigger trg_medications_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- =========================================================
-- weight_log → documents FK (after documents exists)
-- =========================================================

alter table public.weight_log
  add constraint fk_weight_log_document
  foreign key (document_id) references public.documents(id) on delete set null;

-- =========================================================
-- document_pet_links (many-to-many for multi-pet docs)
-- =========================================================

create table public.document_pet_links (
  document_id uuid not null references public.documents(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  primary key (document_id, pet_id)
);

create index idx_document_pet_links_pet on public.document_pet_links(pet_id);

-- =========================================================
-- reminders
-- =========================================================

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  pet_id uuid references public.pets(id) on delete cascade,
  due_on date not null,
  lead_days int not null,
  channel reminder_channel not null default 'email',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  resend_message_id text,
  status reminder_status not null default 'scheduled',
  snoozed_until timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uniq_reminders_idempotency
  on public.reminders (entity_type, entity_id, lead_days);
create index idx_reminders_household_status on public.reminders(household_id, status);
create index idx_reminders_scheduled on public.reminders(scheduled_for) where status = 'scheduled' and sent_at is null;

create trigger trg_reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- =========================================================
-- reminder_preferences (per household)
-- =========================================================

create table public.reminder_preferences (
  household_id uuid primary key references public.households(id) on delete cascade,
  vaccine_lead_days int[] not null default '{30,14,7,1}',
  email_enabled boolean not null default true,
  email_address text,
  timezone text not null default 'America/New_York',
  quiet_hour_start int,
  quiet_hour_end int,
  updated_at timestamptz not null default now()
);

create trigger trg_reminder_prefs_updated_at
  before update on public.reminder_preferences
  for each row execute function public.set_updated_at();
