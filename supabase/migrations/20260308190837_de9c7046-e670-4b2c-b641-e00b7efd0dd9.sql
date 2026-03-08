
-- Schedule auto-sync every 30 minutes
SELECT cron.schedule(
  'auto-sync-matches',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nshxgolruvisdzptcxew.supabase.co/functions/v1/sync-matches',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zaHhnb2xydXZpc2R6cHRjeGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5OTM2NDIsImV4cCI6MjA4ODU2OTY0Mn0.MnRqfL4GnKFYhqIsfuqA2k6mLCePe8H8uSaYW-78Skw"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
