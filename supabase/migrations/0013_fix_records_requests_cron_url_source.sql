
-- Switch from current_setting() to vault.decrypted_secrets to be consistent
-- with the secret-handling pattern used by pawdex-daily-reminders. The
-- pawdex_app_url vault secret must be set once before this fires:
--   select vault.create_secret('https://your-app.vercel.app', 'pawdex_app_url');

select cron.unschedule('pawdex-records-requests');

select cron.schedule(
  'pawdex-records-requests',
  '0 14 * * *',
  $$
    select net.http_post(
      url := coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'pawdex_app_url' limit 1),
        'https://example.invalid'
      ) || '/api/cron/records-requests',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization',
          'Bearer ' || coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'pawdex_cron_secret' limit 1),
            'unset'
          )
      ),
      body := jsonb_build_object('triggered_at', now())
    ) as request_id;
  $$
);
