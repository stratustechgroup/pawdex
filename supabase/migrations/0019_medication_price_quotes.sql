
-- Owner-curated price quotes for an active medication. Pawdex doesn't scrape
-- pricing APIs in v1 — the owner shops, enters what they find, and Pawdex
-- ranks. Future: partner integrations (Chewy Pharmacy, etc.) to backfill.

create type public.pharmacy_source as enum (
  'chewy',
  'costco',
  'goodrx',
  '1800petmeds',
  'walmart',
  'vet_in_house',
  'other'
);

create table public.medication_price_quotes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  source public.pharmacy_source not null,
  pack_size_label text,         -- "30 ct, 75mg" — free text since drugs vary
  price_cents integer not null check (price_cents >= 0),
  link_url text,
  notes text,
  recorded_on date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index medication_price_quotes_med_idx
  on public.medication_price_quotes(medication_id, price_cents);

alter table public.medication_price_quotes enable row level security;

create policy "medqty_read"
  on public.medication_price_quotes
  for select
  using (public.is_household_member(household_id));

create policy "medqty_insert"
  on public.medication_price_quotes
  for insert
  with check (public.has_household_write(household_id));

create policy "medqty_delete"
  on public.medication_price_quotes
  for delete
  using (public.has_household_write(household_id));

comment on table public.medication_price_quotes is
  'Owner-entered price quotes from pharmacies for a medication. Pawdex ranks by price_cents and surfaces the cheapest.';
