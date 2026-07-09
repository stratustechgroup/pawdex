
-- Insurance claims tracking. Owner-driven — Pawdex never decides whether a
-- claim is valid; it just records what was submitted and what the insurer
-- said. Appeal letter drafting (when denied) goes through Sonnet under the
-- insurer_clarification_emails authorization.

create type public.claim_status as enum (
  'drafted',
  'submitted',
  'approved',
  'partially_approved',
  'denied',
  'appealed',
  'closed'
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  insurance_policy_id uuid references public.insurance_policies(id) on delete set null,
  status public.claim_status not null default 'drafted',
  service_date date,
  submitted_on date,
  decided_on date,
  claim_number text,
  total_billed_cents integer check (total_billed_cents is null or total_billed_cents >= 0),
  amount_approved_cents integer check (amount_approved_cents is null or amount_approved_cents >= 0),
  amount_reimbursed_cents integer check (amount_reimbursed_cents is null or amount_reimbursed_cents >= 0),
  denial_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index claims_household_pet_idx on public.claims(household_id, pet_id);
create index claims_policy_year_idx
  on public.claims(insurance_policy_id, service_date desc);
create index claims_status_idx on public.claims(household_id, status);

-- Many-to-many: which medical events + documents are attached to each claim.
create table public.claim_attachments (
  claim_id uuid not null references public.claims(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('medical_event','document')),
  attachment_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (claim_id, attachment_type, attachment_id)
);

create index claim_attachments_claim_idx on public.claim_attachments(claim_id);

alter table public.claims enable row level security;
alter table public.claim_attachments enable row level security;

create policy "claims_read"
  on public.claims
  for select
  using (public.is_household_member(household_id));
create policy "claims_write"
  on public.claims
  for all
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

create policy "claim_attachments_read"
  on public.claim_attachments
  for select
  using (public.is_household_member(household_id));
create policy "claim_attachments_write"
  on public.claim_attachments
  for all
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

comment on table public.claims is
  'Insurance claims tracking. Owner-driven — Pawdex records but never decides validity.';
