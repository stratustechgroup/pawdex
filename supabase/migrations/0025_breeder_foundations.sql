-- Pawdex Phase 6.41 — breeder foundations (expand phase).
--
-- Adds the breeder shape on top of the animal identity core: households can be
-- flagged as breeder operations, litters group animals born together, and each
-- animal carries a placement status for the rehome / adoption pipeline.

-- =========================================================
-- households.kind — personal vs breeder operation.
-- =========================================================

create type household_kind as enum ('personal', 'breeder');

alter table public.households
  add column kind household_kind not null default 'personal';

-- =========================================================
-- placement status on animals — drives the breeder placement board.
-- =========================================================

create type animal_placement_status as enum ('none', 'available', 'reserved', 'placed');

alter table public.animals
  add column placement_status animal_placement_status not null default 'none';

-- =========================================================
-- litters
-- =========================================================

create table public.litters (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  dam_animal_id uuid not null references public.animals(id) on delete restrict,
  sire_animal_id uuid references public.animals(id) on delete set null,
  whelped_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_litters_household on public.litters(household_id, created_at desc);
create index idx_litters_dam on public.litters(dam_animal_id);

create trigger trg_litters_updated_at
  before update on public.litters
  for each row execute function public.set_updated_at();

-- Now that litters exists, wire the animals.litter_id FK declared in 0024.
alter table public.animals
  add constraint fk_animals_litter
  foreign key (litter_id) references public.litters(id) on delete set null;

create index idx_animals_litter on public.animals(litter_id) where litter_id is not null;

-- =========================================================
-- RLS — standard household pattern.
-- =========================================================

alter table public.litters enable row level security;

create policy "litters_select" on public.litters
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "litters_insert" on public.litters
  for insert to authenticated
  with check (public.has_household_write(household_id));

create policy "litters_update" on public.litters
  for update to authenticated
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

create policy "litters_delete" on public.litters
  for delete to authenticated
  using (public.has_household_write(household_id));
