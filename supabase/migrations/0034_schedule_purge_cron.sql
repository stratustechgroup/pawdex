-- Schedule the daily hard-purge job via pg_cron + pg_net, mirroring the
-- records-requests cron (0013). It POSTs to the Next API route
-- /api/cron/purge-deletions, which runs the shared purge module in Node so the
-- same code path backs both the scheduled purge and the immediate (CCPA) delete
-- server action. Authenticated with the same pawdex_cron_secret vault secret as
-- the other jobs; the app URL comes from the pawdex_app_url vault secret.
--
-- Prereqs (set once, same as 0007 / 0013):
--   select vault.create_secret('https://your-app.vercel.app', 'pawdex_app_url');
--   select vault.create_secret('your-long-random-string', 'pawdex_cron_secret');
-- and CRON_SECRET must match on the app side.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pawdex-purge-deletions') then
    perform cron.unschedule('pawdex-purge-deletions');
  end if;
end;
$$;

select cron.schedule(
  'pawdex-purge-deletions',
  '30 6 * * *',  -- 06:30 UTC daily, offset from the other jobs to spread load
  $$
    select net.http_post(
      url := coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'pawdex_app_url' limit 1),
        'https://example.invalid'
      ) || '/api/cron/purge-deletions',
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
