-- Pawdex, self-serve deletion + retention foundations.
--
-- Deletion works at three levels (pet, household, account) with a 30-day
-- soft-delete retention window, restore, and a daily hard-purge job. This
-- migration adds the columns and tables that back all three.
--
-- Convention (documented here so it stays coherent):
--   deleted_at  = SOFT DELETE. Hidden everywhere immediately, restorable for
--                 30 days, then hard-purged by the daily purge job. This is the
--                 ONLY marker the purge job and the "recently deleted" UI read.
--   archived_at = the pre-existing "keep forever, hide from active lists"
--                 archive semantic (pets.archived_at, animals.archived_at,
--                 insurance_policies.archived_at). Never purged. Left untouched.
-- The two are deliberately separate columns so an individually-deleted pet is
-- always distinguishable from an archived-but-kept one on restore.

-- =========================================================
-- pets: soft-delete marker distinct from archived_at.
-- =========================================================

alter table public.pets
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- =========================================================
-- households: soft-delete marker. A soft-deleted household disappears from the
-- switcher and every household-scoped surface immediately (resolved out in
-- requireSession), so all nested content is hidden without touching child rows.
-- =========================================================

alter table public.households
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- Purge-scan indexes: the daily job scans for soft-deleted rows past the
-- retention window, so index the deleted_at needle directly (partial, so the
-- index only carries the rare soft-deleted rows).
create index if not exists idx_pets_deleted_at
  on public.pets(deleted_at) where deleted_at is not null;
create index if not exists idx_households_deleted_at
  on public.households(deleted_at) where deleted_at is not null;

-- =========================================================
-- deletion_log: durable trace that OUTLIVES the household/account it records.
-- audit_log cascades away with its household, so household + account deletions
-- would leave no trace there. deletion_log intentionally carries NO foreign key
-- to households or auth.users, so it survives both the household FK cascade and
-- the auth.users hard delete. It stores the minimum needed to answer "what was
-- deleted, when, by whom, and under what legal basis" for a CCPA record.
-- =========================================================

create table if not exists public.deletion_log (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('pet', 'household', 'account')),
  subject_id uuid,          -- pet_id / household_id / user_id (plain uuid, no FK)
  household_id uuid,        -- context household (plain uuid, no FK)
  actor_user_id uuid,       -- who requested it (plain uuid, no FK)
  actor_email text,
  legal_basis text not null
    check (legal_basis in ('user_request', 'ccpa_immediate', 'retention_purge')),
  action text not null
    check (action in ('soft_delete', 'restore', 'hard_purge')),
  details jsonb not null default '{}',  -- counts, enumerated households, storage prefixes
  created_at timestamptz not null default now()
);

create index if not exists idx_deletion_log_subject on public.deletion_log(subject_id);
create index if not exists idx_deletion_log_actor on public.deletion_log(actor_user_id);

alter table public.deletion_log enable row level security;
-- Service-role only. No policies: the durable ledger is never read by users.

-- =========================================================
-- account_deletions: operational grace-period state for account deletion.
-- Unlike deletion_log this DOES cascade on auth.users delete (it is transient
-- state, not the durable trace). While status = 'pending' the account is in its
-- retention window: the user is signed out and, on next login, offered restore
-- until purge_after passes. An 'immediate' (CCPA) request skips the window and
-- is purged inline, landing here already 'completed' for the brief moment
-- before the auth.users row (and this row) are gone.
-- =========================================================

create table if not exists public.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null,
  mode text not null check (mode in ('scheduled', 'immediate')),
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'completed')),
  requested_email text,                              -- snapshot for the durable log
  sole_owned_households jsonb not null default '[]', -- [{id, name}] enumerated + deleted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_deletions_pending
  on public.account_deletions(purge_after) where status = 'pending';

alter table public.account_deletions enable row level security;
create policy "account_deletions_select_own" on public.account_deletions
  for select to authenticated using (user_id = auth.uid());
-- Writes are service-role only.

create trigger trg_account_deletions_updated_at
  before update on public.account_deletions
  for each row execute function public.set_updated_at();
