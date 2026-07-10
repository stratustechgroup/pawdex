-- Pawdex Phase 6.41 — animal identity core (expand phase).
--
-- Introduces `animals` as the durable, household-independent identity for a
-- creature, and `custodianships` as the tenancy link between an animal and the
-- households that currently hold it (owner / breeder / foster / co_owner).
--
-- This is the EXPAND half of an expand-and-contract migration: everything here
-- is additive. `pets` keeps working exactly as before; `pets.animal_id` links
-- each legacy pet to its new animal, and a trigger mirrors legacy pet edits
-- onto the animal so the new table stays truthful while the old UI is live.
-- The CONTRACT phase (a later migration) will move record FKs onto animal_id
-- and retire the mirror. See docs/identity-core.md.

-- =========================================================
-- Enums
-- =========================================================

create type custodianship_role as enum ('owner', 'breeder', 'foster', 'co_owner');

-- =========================================================
-- animals — durable identity. Deliberately has NO household_id:
-- tenancy is expressed through custodianships so an animal can move
-- between households (transfer) and be co-held (breeder + placement)
-- without rewriting the identity row.
-- =========================================================

create table public.animals (
  id uuid primary key default gen_random_uuid(),
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
  microchip_implanted_on date,
  photo_storage_path text,
  current_weight_kg numeric(6, 3),
  acquired_on date,
  allergies text,
  notes text,
  -- Pedigree self-references. Nullable; set null if a parent row is removed.
  sire_id uuid references public.animals(id) on delete set null,
  dam_id uuid references public.animals(id) on delete set null,
  -- litter_id FK is added in 0025 (litters does not exist yet).
  litter_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index idx_animals_microchip on public.animals(microchip_number)
  where microchip_number is not null;
create index idx_animals_sire on public.animals(sire_id) where sire_id is not null;
create index idx_animals_dam on public.animals(dam_id) where dam_id is not null;

create trigger trg_animals_updated_at
  before update on public.animals
  for each row execute function public.set_updated_at();

comment on column public.animals.microchip_number is
  'Permanent implanted ID. Besides identity, this is the natural de-identification anchor for research: a stable per-animal key that survives transfers across owners, so aggregate datasets can dedupe/link an animal without carrying any owner PII. See 0027 research consent.';

-- =========================================================
-- custodianships — active/historical link animal ↔ household.
-- =========================================================

create table public.custodianships (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  role custodianship_role not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- At most one ACTIVE custodianship per (animal, household). Ended rows are
-- unconstrained history.
create unique index uniq_custodianships_active
  on public.custodianships (animal_id, household_id)
  where ended_at is null;
-- "active custodianships held by a household" — drives the household roster.
create index idx_custodianships_active_household
  on public.custodianships (household_id, animal_id)
  where ended_at is null;
create index idx_custodianships_animal on public.custodianships (animal_id);

-- =========================================================
-- pets.animal_id — links each legacy pet to its animal identity.
-- =========================================================

alter table public.pets
  add column animal_id uuid unique references public.animals(id) on delete set null;

-- =========================================================
-- RLS helper: is_animal_custodian
-- True when the caller is a member of any household that currently holds an
-- active custodianship over the animal. Security definer so it can see
-- custodianships regardless of the caller's row-level access to that table.
-- =========================================================

create or replace function public.is_animal_custodian(p_animal uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.custodianships c
    where c.animal_id = p_animal
      and c.ended_at is null
      and public.is_household_member(c.household_id)
  );
$$;

grant execute on function public.is_animal_custodian(uuid) to authenticated;

-- =========================================================
-- RLS
-- animals: read = any active custodian household you belong to; update = same
--   but requires write in that household. Insert/delete are service-role only
--   (an animal is born together with its first custodianship, done server-side
--   or via the mirror trigger, so there is no safe household to gate a bare
--   authenticated insert on).
-- custodianships: read = members of the holding household; all writes are
--   service-role only, mirroring household_members.
-- =========================================================

alter table public.animals enable row level security;
alter table public.custodianships enable row level security;

create policy "animals_select" on public.animals
  for select to authenticated
  using (public.is_animal_custodian(id));

create policy "animals_update" on public.animals
  for update to authenticated
  using (
    exists (
      select 1 from public.custodianships c
      where c.animal_id = animals.id
        and c.ended_at is null
        and public.has_household_write(c.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.custodianships c
      where c.animal_id = animals.id
        and c.ended_at is null
        and public.has_household_write(c.household_id)
    )
  );

create policy "custodianships_select" on public.custodianships
  for select to authenticated
  using (public.is_household_member(household_id));

-- custodianship inserts/updates/deletes via service role only.

-- =========================================================
-- Mirror trigger — keep animals.* truthful when the legacy pet edit UI
-- updates a linked pet. Runs security definer so it can write animals
-- regardless of the editing user's row access to that table.
-- =========================================================

create or replace function public.sync_animal_from_pet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.animal_id is not null then
    update public.animals set
      name = new.name,
      species = new.species,
      breed = new.breed,
      sex = new.sex,
      altered = new.altered,
      date_of_birth = new.date_of_birth,
      dob_is_estimated = new.dob_is_estimated,
      color = new.color,
      markings = new.markings,
      microchip_number = new.microchip_number,
      microchip_registry = new.microchip_registry,
      microchip_implanted_on = new.microchip_implanted_on,
      photo_storage_path = new.photo_storage_path,
      current_weight_kg = new.current_weight_kg,
      acquired_on = new.acquired_on,
      allergies = new.allergies,
      notes = new.notes,
      archived_at = new.archived_at,
      updated_at = now()
    where id = new.animal_id;
  end if;
  return new;
end;
$$;

create trigger trg_pets_sync_animal
  after update on public.pets
  for each row execute function public.sync_animal_from_pet();

-- =========================================================
-- Backfill — one animal per existing pet, linked, with an owner
-- custodianship in the pet's household. Idempotent: only touches pets whose
-- animal_id is still null, so re-running (or scripts/backfill-animals.ts) is
-- safe.
-- =========================================================

do $$
declare
  r record;
  v_animal uuid;
begin
  for r in select * from public.pets where animal_id is null loop
    insert into public.animals (
      name, species, breed, sex, altered, date_of_birth, dob_is_estimated,
      color, markings, microchip_number, microchip_registry,
      microchip_implanted_on, photo_storage_path, current_weight_kg,
      acquired_on, allergies, notes, archived_at, created_at, updated_at,
      created_by
    ) values (
      r.name, r.species, r.breed, r.sex, r.altered, r.date_of_birth,
      r.dob_is_estimated, r.color, r.markings, r.microchip_number,
      r.microchip_registry, r.microchip_implanted_on, r.photo_storage_path,
      r.current_weight_kg, r.acquired_on, r.allergies, r.notes, r.archived_at,
      r.created_at, r.updated_at, r.created_by
    )
    returning id into v_animal;

    update public.pets set animal_id = v_animal where id = r.id;

    insert into public.custodianships (
      animal_id, household_id, role, started_at, created_by
    ) values (
      v_animal, r.household_id, 'owner', r.created_at, r.created_by
    );
  end loop;
end;
$$;
