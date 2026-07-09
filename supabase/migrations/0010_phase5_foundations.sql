-- Pawdex Phase 5 foundations.
-- All tables here exist so subsequent rounds can layer features on without
-- another schema change. Tables and enums are scoped to the household pattern
-- already established; RLS reuses is_household_member / has_household_write.

create extension if not exists vector with schema extensions;

-- ============================================================
-- Authorizations — explicit, immutable consent for each outbound
-- action Pawdex can take on the user's behalf.
-- ============================================================

create type authorization_type as enum (
  'records_request_to_vets',
  'records_distribution_to_third_parties',
  'insurer_clarification_emails',
  'affiliate_disclosure_acknowledged'
);

create table public.authorizations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  authorization_type authorization_type not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  -- Frozen copy of the exact consent text the user agreed to. If we change
  -- the wording later, old authorizations still know what was promised.
  scope_text text not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  ip_address text,
  user_agent text
);

create index idx_authorizations_household_type
  on public.authorizations(household_id, authorization_type, granted_at desc);
create index idx_authorizations_active
  on public.authorizations(household_id, authorization_type)
  where revoked_at is null;

alter table public.authorizations enable row level security;
create policy "authorizations_select" on public.authorizations
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "authorizations_insert" on public.authorizations
  for insert to authenticated
  with check (public.has_household_write(household_id));
create policy "authorizations_update" on public.authorizations
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

-- ============================================================
-- Outbound emails — audit log of every email Pawdex sends on
-- the user's behalf. Hard FK to authorizations.
-- ============================================================

create type outbound_recipient_type as enum (
  'vet_clinic',
  'insurer',
  'boarding_facility',
  'specialist',
  'pharmacy',
  'other'
);

create type outbound_email_status as enum (
  'drafted',
  'queued',
  'sent',
  'bounced',
  'failed',
  'replied'
);

create table public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  authorization_id uuid not null references public.authorizations(id) on delete restrict,
  recipient_email text not null,
  recipient_name text,
  recipient_type outbound_recipient_type not null,
  template_id text,
  subject text not null,
  body_text text not null,
  body_html text,
  status outbound_email_status not null default 'drafted',
  resend_message_id text,
  reply_thread_id text,
  sent_at timestamptz,
  reply_received_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_outbound_emails_household_created
  on public.outbound_emails(household_id, created_at desc);
create index idx_outbound_emails_status
  on public.outbound_emails(status, created_at desc);

alter table public.outbound_emails enable row level security;
create policy "outbound_emails_select" on public.outbound_emails
  for select to authenticated
  using (public.is_household_member(household_id));
-- inserts only via service role (the actions running on behalf of users)

-- ============================================================
-- Insurance policies — ingested via document upload (insurance
-- policy PDFs), surfaced as structured rows.
-- ============================================================

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  insurer_name text not null,
  plan_name text,
  policy_number text,
  premium_monthly_cents integer,
  deductible_annual_cents integer,
  reimbursement_rate numeric(3, 2),
  annual_max_cents integer,
  effective_on date,
  renews_on date,
  document_id uuid references public.documents(id) on delete set null,
  extracted_exclusions text[],
  extracted_pec_definitions jsonb,
  raw_extraction jsonb,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_insurance_policies_household_pet
  on public.insurance_policies(household_id, pet_id);
create index idx_insurance_policies_active
  on public.insurance_policies(household_id, pet_id)
  where archived_at is null;

create trigger trg_insurance_policies_updated_at
  before update on public.insurance_policies
  for each row execute function public.set_updated_at();

alter table public.insurance_policies enable row level security;
create policy "insurance_policies_select" on public.insurance_policies
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "insurance_policies_insert" on public.insurance_policies
  for insert to authenticated
  with check (public.has_household_write(household_id));
create policy "insurance_policies_update" on public.insurance_policies
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));
create policy "insurance_policies_delete" on public.insurance_policies
  for delete to authenticated
  using (public.has_household_write(household_id));

-- ============================================================
-- Cost estimates — true out-of-pocket calculator state machine.
-- ============================================================

create type cost_estimate_status as enum (
  'pending_vet_response',
  'computed',
  'expired',
  'cancelled'
);

create table public.cost_estimates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  insurance_policy_id uuid references public.insurance_policies(id) on delete set null,
  request_email_id uuid references public.outbound_emails(id) on delete set null,
  response_document_id uuid references public.documents(id) on delete set null,
  procedure_summary text not null,
  gross_estimate_cents integer,
  applied_deductible_cents integer,
  reimbursement_eligible_cents integer,
  reimbursement_rate numeric(3, 2),
  true_oop_cents integer,
  computed_by_model text,
  computed_at timestamptz,
  status cost_estimate_status not null default 'pending_vet_response',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_cost_estimates_household_status
  on public.cost_estimates(household_id, status, created_at desc);
create index idx_cost_estimates_pet
  on public.cost_estimates(pet_id, created_at desc);

create trigger trg_cost_estimates_updated_at
  before update on public.cost_estimates
  for each row execute function public.set_updated_at();

alter table public.cost_estimates enable row level security;
create policy "cost_estimates_select" on public.cost_estimates
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "cost_estimates_insert" on public.cost_estimates
  for insert to authenticated
  with check (public.has_household_write(household_id));
create policy "cost_estimates_update" on public.cost_estimates
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

-- ============================================================
-- Extraction chunks — pgvector-backed text chunks of extracted
-- documents for the Q&A feature. Populated post-commit.
-- ============================================================

create table public.extraction_chunks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid references public.document_extractions(id) on delete cascade,
  -- Free-text representation: structured extraction flattened to natural
  -- language ("Bailey received rabies vaccine on 2024-04-12, lot ABC123,
  -- expires 2027-04-12, given at Cedar Park Animal Clinic").
  content text not null,
  -- Field path that points back into raw_extraction (e.g. "vaccinations[0]")
  -- so the answer UI can cite + link.
  source_path text,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index idx_extraction_chunks_household_pet
  on public.extraction_chunks(household_id, pet_id);
-- ivfflat index for cosine similarity. Build after data lands; cheap empty.
create index idx_extraction_chunks_embedding
  on public.extraction_chunks
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

alter table public.extraction_chunks enable row level security;
create policy "extraction_chunks_select" on public.extraction_chunks
  for select to authenticated
  using (public.is_household_member(household_id));
-- inserts/updates via service role only (extraction pipeline)

-- ============================================================
-- Pending records requests — queue of "ask the vet for the SOAP
-- note for visit X" requests, processed by a daily cron.
-- ============================================================

create type pending_request_status as enum (
  'scheduled',
  'sent',
  'cancelled',
  'failed'
);

create table public.pending_records_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  vet_clinic_id uuid references public.vet_clinics(id) on delete set null,
  -- The triggering event (medical_event row, or null for ad-hoc requests).
  medical_event_id uuid references public.medical_events(id) on delete set null,
  -- Free text describing what we're asking for ("full clinical notes from the
  -- April 14, 2026 visit"). Used in the email body.
  request_summary text not null,
  scheduled_for timestamptz not null,
  status pending_request_status not null default 'scheduled',
  outbound_email_id uuid references public.outbound_emails(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_pending_requests_scheduled
  on public.pending_records_requests(scheduled_for)
  where status = 'scheduled';
create index idx_pending_requests_household
  on public.pending_records_requests(household_id, created_at desc);

alter table public.pending_records_requests enable row level security;
create policy "pending_requests_select" on public.pending_records_requests
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "pending_requests_insert" on public.pending_records_requests
  for insert to authenticated
  with check (public.has_household_write(household_id));
create policy "pending_requests_update" on public.pending_records_requests
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

-- ============================================================
-- Household inbound addresses — maps the slug in
-- `inbox+{slug}@pawdex.app` to a household_id. Slugs are unique
-- globally so a single mailbox can route to any household.
-- ============================================================

create table public.household_inbound_addresses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create index idx_household_inbound_household on public.household_inbound_addresses(household_id);

alter table public.household_inbound_addresses enable row level security;
create policy "household_inbound_select" on public.household_inbound_addresses
  for select to authenticated
  using (public.is_household_member(household_id));
-- inserts via service role only (bootstrap creates them on first sign-in)