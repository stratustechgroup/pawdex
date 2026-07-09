-- Pawdex Phase 4: audit log + household invitations.

-- ============================================================
-- Audit log
-- ============================================================

create type audit_action as enum (
  'create',
  'update',
  'delete',
  'archive',
  'commit_extraction',
  'discard_extraction',
  'invite_member',
  'revoke_member',
  'accept_invitation',
  'login',
  'preferences_change'
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action audit_action not null,
  entity_type text not null,           -- 'pet' | 'vaccination' | 'medication' | 'medical_event' | 'weight_log' | 'vet_clinic' | 'document' | 'household_member' | 'reminder_preferences' etc.
  entity_id uuid,                       -- the row that changed (when applicable)
  diff jsonb not null default '{}',     -- { before: {...}, after: {...} } or other context
  created_at timestamptz not null default now()
);

create index idx_audit_log_household_created on public.audit_log(household_id, created_at desc);
create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);

alter table public.audit_log enable row level security;

create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (public.is_household_member(household_id));

-- inserts only via service role (Server Actions log on the user's behalf).

-- ============================================================
-- Household invitations
-- ============================================================

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  -- token_hash is sha256 of the random token; we never store the token itself.
  token_hash text not null,
  role household_role not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index uniq_household_invitations_token on public.household_invitations(token_hash);
create index idx_household_invitations_household on public.household_invitations(household_id, created_at desc);
create index idx_household_invitations_email on public.household_invitations(lower(email));

alter table public.household_invitations enable row level security;

create policy "invitations_select" on public.household_invitations
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "invitations_insert" on public.household_invitations
  for insert to authenticated
  with check (public.has_household_write(household_id));

create policy "invitations_update" on public.household_invitations
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));