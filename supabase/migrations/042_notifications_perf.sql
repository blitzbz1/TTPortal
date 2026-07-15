-- Performance + retention improvements for notifications.
--
-- 1. Composite index (recipient_id, created_at DESC) lets the inbox query walk
--    the index in order and stop at LIMIT, instead of fetching all rows for
--    the user and sorting. The previous (recipient_id) index is now redundant
--    for the inbox path and is dropped.
-- 2. 30-day retention cleanup keeps the table lean, scheduled hourly via
--    pg_cron when available.

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC);

DROP INDEX IF EXISTS idx_notifications_recipient;

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % old notifications', deleted_count;
  END IF;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'cleanup-old-notifications',
    '30 * * * *',
    'SELECT public.cleanup_old_notifications()'
  );
  RAISE NOTICE 'Scheduled notifications cleanup cron job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron -- pg_cron not available';
END $$;
