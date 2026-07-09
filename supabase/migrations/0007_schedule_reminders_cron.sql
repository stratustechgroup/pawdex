-- Schedule the daily reminders Edge Function via pg_cron + pg_net.
-- The bearer secret lives in Supabase Vault (encrypted at rest) so this
-- migration can be committed safely. The user seeds the secret value
-- *after* this migration runs via:
--
--   select vault.create_secret('your-long-random-string', 'pawdex_cron_secret');
--
-- and sets the matching CRON_SECRET secret on the Edge Function side.

-- Unschedule any existing job with the same name so this migration is idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'pawdex-daily-reminders') then
    perform cron.unschedule('pawdex-daily-reminders');
  end if;
end;
$$;

select cron.schedule(
  'pawdex-daily-reminders',
  '0 13 * * *',  -- 13:00 UTC = ~08:00 ET
  $$
    select net.http_post(
      url := 'https://ozexfuawzqjcjgdhgrqx.supabase.co/functions/v1/reminders-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization',
          'Bearer ' || coalesce(
            (select decrypted_secret from vault.decrypted_secrets
              where name = 'pawdex_cron_secret' limit 1),
            'unset'
          )
      ),
      body := jsonb_build_object('triggered_at', now())
    ) as request_id;
  $$
);