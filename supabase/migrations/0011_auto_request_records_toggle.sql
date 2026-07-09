
-- Phase 5.6 — toggle for auto-scheduling records requests after vet visits.
alter table reminder_preferences
  add column if not exists auto_request_records boolean not null default false;

alter table reminder_preferences
  add column if not exists auto_request_lead_days integer not null default 1
  check (auto_request_lead_days >= 0 and auto_request_lead_days <= 30);

comment on column reminder_preferences.auto_request_records is
  'When true, every committed medical event with a vet clinic on file enqueues a records-request email scheduled for occurred_on + auto_request_lead_days days. Requires records_request_to_vets authorization.';
