-- Pawdex — user profiles.
--
-- Gives every auth user a durable public.profiles row holding a display name,
-- so the app can greet people and list household members by name instead of
-- raw email. The row is created automatically for new signups by a trigger on
-- auth.users, and backfilled here for everyone who already exists.
--
-- Hardening follows 0028: SECURITY DEFINER functions pin search_path and are
-- not exposed as RPC to the API roles that don't need them. The auth.users
-- trigger function needs no role EXECUTE at fire time (the privilege is checked
-- when the trigger is created, and it fires as the auth admin role), so it is
-- revoked from public/anon/authenticated entirely.

-- =========================================================
-- profiles — one row per auth user.
-- =========================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Per-user profile. Display name only; no PII beyond what auth.users already holds. RLS: read your own row plus fellow household members; update only your own.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========================================================
-- Auto-create a profile whenever an auth user is created. SECURITY DEFINER so
-- it can write public.profiles regardless of the role performing the signup.
-- Seeds display_name from the OAuth/metadata full_name when present; otherwise
-- leaves it null for the user to set.
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger function: never a legitimate RPC target (see 0028).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- current_user_has_password — true when the calling user has a password set,
-- so the account UI can label the form "Add a password" vs "Change password".
-- encrypted_password is not visible to the API roles, hence a definer helper
-- scoped strictly to the caller's own row. GoTrue stores '' or NULL for
-- passwordless (magic-link-only) users depending on version; both mean "none".
-- =========================================================

create or replace function public.current_user_has_password()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and encrypted_password is not null
      and encrypted_password <> ''
  );
$$;

revoke execute on function public.current_user_has_password() from public, anon;
grant execute on function public.current_user_has_password() to authenticated, service_role;

-- =========================================================
-- RLS
-- select: your own row, plus the profile of anyone who shares a household with
--   you (needed for member lists). The fellow-member arm reads household_members
--   and calls the SECURITY DEFINER is_household_member helper, which bypasses
--   RLS on household_members — nothing here reads profiles, so no recursion.
-- update: your own row only (both USING and WITH CHECK).
-- insert/delete: no authenticated policy. Rows are born from the trigger and
--   backfill (both privileged) and removed by the auth.users cascade.
-- =========================================================

alter table public.profiles enable row level security;

create policy "profiles_select_self_or_household" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.household_members hm
      where hm.user_id = profiles.id
        and public.is_household_member(hm.household_id)
    )
  );

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =========================================================
-- Backfill — one profile per existing auth user. Idempotent via on conflict,
-- so re-running is safe. Seeds display_name from metadata full_name when set.
-- =========================================================

insert into public.profiles (id, display_name)
select u.id, nullif(u.raw_user_meta_data->>'full_name', '')
from auth.users u
on conflict (id) do nothing;
