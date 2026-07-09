
-- Daily records-requests cron — calls the Next.js route handler at 14:00 UTC
-- (offset by an hour from reminders-cron so we don't pile both onto the same
-- minute). The handler authenticates via the same CRON_SECRET vault item.

select cron.schedule(
  'pawdex-records-requests',
  '0 14 * * *',
  $$
    select net.http_post(
      url := current_setting('app.pawdex_app_url') || '/api/cron/records-requests',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'pawdex_cron_secret' limit 1
        )
      ),
      body := jsonb_build_object('triggered_at', now())
    );
  $$
);

comment on extension pg_cron is
  'Pawdex schedules: pawdex-daily-reminders (13:00 UTC) and pawdex-records-requests (14:00 UTC).';
