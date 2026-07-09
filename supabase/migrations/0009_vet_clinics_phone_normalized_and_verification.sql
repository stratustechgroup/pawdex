-- Phone normalization helper: last 10 digits (drops country code + formatting).
-- Used for phone-based clinic dedupe. NULL when input has fewer than 10 digits.
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
as $$
  with d as (
    select regexp_replace(coalesce(p, ''), '\D', '', 'g') as digits
  )
  select case when length(d.digits) >= 10 then right(d.digits, 10) else null end
  from d;
$$;

-- Generated stored column on vet_clinics so we can index + query without a
-- regex pass on every comparison.
alter table public.vet_clinics
  add column phone_normalized text generated always as (public.normalize_phone(phone)) stored;

create index idx_vet_clinics_household_phone
  on public.vet_clinics(household_id, phone_normalized)
  where phone_normalized is not null;

-- Verification tracking. verified_source is a free-text label so we can
-- record 'manual' edits, 'web' lookups, future API integrations, etc.
alter table public.vet_clinics
  add column verified_at timestamptz,
  add column verified_source text;