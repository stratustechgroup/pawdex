-- Pawdex — RLS policies
-- Household-scoped tenancy: every row gates on user's membership in the household.
-- Writes additionally require role in (owner, member).

-- =========================================================
-- helper: is_household_member, has_household_write
-- =========================================================

create or replace function public.is_household_member(p_household uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_household_write(p_household uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household
      and user_id = auth.uid()
      and role in ('owner', 'member')
  );
$$;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_write(uuid) to authenticated;

-- =========================================================
-- enable RLS
-- =========================================================

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.pets enable row level security;
alter table public.weight_log enable row level security;
alter table public.vaccinations enable row level security;
alter table public.medical_events enable row level security;
alter table public.medications enable row level security;
alter table public.vet_clinics enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_pet_links enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_preferences enable row level security;

-- =========================================================
-- households: members can read; owners can update; creators can insert
-- =========================================================

create policy "households_select" on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy "households_insert" on public.households
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "households_update" on public.households
  for update to authenticated
  using (public.has_household_write(id))
  with check (public.has_household_write(id));

-- delete intentionally not exposed via RLS at this stage

-- =========================================================
-- household_members: users can see only their own memberships
--   inserts handled via service role (bootstrap + invite accept)
-- =========================================================

create policy "household_members_select_self" on public.household_members
  for select to authenticated
  using (user_id = auth.uid());

create policy "household_members_select_household" on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

-- =========================================================
-- generic household-scoped policy generator
-- =========================================================

do $$
declare
  t text;
  tables text[] := array[
    'pets',
    'weight_log',
    'vaccinations',
    'medical_events',
    'medications',
    'vet_clinics',
    'documents',
    'document_extractions',
    'document_pet_links',
    'reminders',
    'reminder_preferences'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_household_write(household_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_household_write(household_id)) with check (public.has_household_write(household_id))',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_household_write(household_id))',
      t || '_delete', t
    );
  end loop;
end;
$$;
