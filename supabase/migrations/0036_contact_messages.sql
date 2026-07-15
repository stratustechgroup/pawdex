-- Pawdex. Pre-launch contact-form capture.
--
-- The public marketing /contact page posts here through a Server Action that
-- runs with the service role (see lib/db/contact.ts). The table holds only what
-- the visitor typed into the contact form: no household, animal, or medical data.
--
-- RLS is enabled with NO policies. It fails closed for anon and authenticated
-- roles alike, so the only writer is the trusted service-role backend. The raw
-- messages stay unreadable from the browser even though the form is public.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  subject text,
  message text not null,
  source text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

-- Powers the ops view (newest first) and any time-window cleanup.
create index idx_contact_messages_created_at
  on public.contact_messages (created_at);

comment on table public.contact_messages is
  'Pre-launch marketing contact-form messages. Service-role only (RLS on, no policies). Not linked to households, animals, or medical records.';

alter table public.contact_messages enable row level security;
-- No policies: service-role only.
