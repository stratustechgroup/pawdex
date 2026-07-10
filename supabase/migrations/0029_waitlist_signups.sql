-- Pawdex — pre-launch waitlist capture.
--
-- Public marketing home posts here through a Server Action that runs with the
-- service role (see lib/db/waitlist.ts). The table holds no personal medical
-- data, only an email and where the signup came from.
--
-- RLS is enabled with NO policies: it fails closed for anon and authenticated
-- roles alike, so the only writer is the trusted service-role backend. That
-- keeps the raw list unreadable from the browser even though the form is public.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now()
);

-- One row per address, case-insensitively. The Server Action lowercases before
-- insert; this index is the backstop and powers the duplicate-friendly path.
create unique index idx_waitlist_signups_email_lower
  on public.waitlist_signups (lower(email));

comment on table public.waitlist_signups is
  'Pre-launch marketing waitlist. Service-role only (RLS on, no policies). Not linked to households, animals, or medical records.';

alter table public.waitlist_signups enable row level security;
-- No policies: service-role only.
