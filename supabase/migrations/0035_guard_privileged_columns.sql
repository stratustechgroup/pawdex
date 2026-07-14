-- Column-level write protection for privileged household/pet columns.
--
-- Background: households_update (0002) and pets_update gate row writes on
-- has_household_write(), which returns true for ANY member (role owner OR
-- member). RLS has no column-level WITH CHECK and the tables carry the default
-- `grant all ... to authenticated`, so a non-owner member could PATCH these
-- columns directly through PostgREST with their own JWT, bypassing the
-- owner-only + OTP server actions:
--   * households.deleted_at / deleted_by  -> backdate to force the daily purge
--       to hard-delete the entire household immediately (permanent, no grace),
--       or set null to un-delete; either way a member-triggered destroy/DoS.
--   * households.plan                      -> self-upgrade to a paid tier for
--       free, bypassing Stripe.
--   * households.kind                      -> flip breeder/personal at will.
--   * pets.deleted_at / deleted_by         -> backdate to skip the retention
--       window, restore an owner's deletion, or spoof deleted_by.
--
-- Every legitimate write to these columns already goes through the service
-- client (role service_role), which is exempt below. The guard denylists the
-- two PostgREST-facing roles rather than allowlisting service_role, so
-- postgres/owner backfills and migrations keep working. SECURITY INVOKER
-- (default) keeps current_user as the real caller. `is distinct from` avoids
-- tripping on clients that resend unchanged columns.

create or replace function public.guard_privileged_household_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.deleted_at is distinct from old.deleted_at
          or new.deleted_by is distinct from old.deleted_by
          or new.plan is distinct from old.plan
          or new.kind is distinct from old.kind) then
    raise exception
      'households.deleted_at/deleted_by/plan/kind are writable only by the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_privileged_pet_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.deleted_at is distinct from old.deleted_at
          or new.deleted_by is distinct from old.deleted_by) then
    raise exception
      'pets.deleted_at/deleted_by are writable only by the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_privileged_household_columns() from public, anon, authenticated;
revoke execute on function public.guard_privileged_pet_columns() from public, anon, authenticated;

drop trigger if exists trg_households_guard_privileged on public.households;
create trigger trg_households_guard_privileged
  before update on public.households
  for each row execute function public.guard_privileged_household_columns();

drop trigger if exists trg_pets_guard_privileged on public.pets;
create trigger trg_pets_guard_privileged
  before update on public.pets
  for each row execute function public.guard_privileged_pet_columns();
