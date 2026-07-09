
-- Tokenized public-share links for one-off "send the kennel my pet's records"
-- flows. The raw token is given to the user once at creation; we only store a
-- SHA-256 hash so a DB breach can't expose live tokens.
--
-- The /share/[token] route handler validates by re-hashing the URL token and
-- looking up the row. RLS is policy-locked to household members only for the
-- management surface; the public route uses the service-role client and does
-- its own expiry / revoke checks.

create type public.share_scope as enum ('boarding_packet');

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  token_hash text not null unique,
  scope public.share_scope not null default 'boarding_packet',
  recipient_label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  last_accessed_at timestamptz,
  access_count integer not null default 0
);

create index share_links_household_pet_idx
  on public.share_links(household_id, pet_id);
create index share_links_active_idx
  on public.share_links(household_id, expires_at)
  where revoked_at is null;

alter table public.share_links enable row level security;

create policy "share_links_read"
  on public.share_links
  for select
  using (public.is_household_member(household_id));

create policy "share_links_insert"
  on public.share_links
  for insert
  with check (public.has_household_write(household_id));

create policy "share_links_update"
  on public.share_links
  for update
  using (public.has_household_write(household_id))
  with check (public.has_household_write(household_id));

comment on table public.share_links is
  'Public read-only share tokens for compliance packets sent to boarding, kennels, etc. token_hash = SHA-256 hex of the URL token. The raw token is shown to the creator ONCE at issuance.';
