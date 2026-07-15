-- Drop public.notifications from the supabase_realtime publication.
--
-- Background: an Apr 28-30 egress spike consumed ~5 GB of Realtime egress in
-- two days on a project with ~4 active users. 99.8% of total egress was
-- Realtime; PostgREST and Storage were negligible. The only subscription in
-- the app was a per-user filtered channel on `notifications`, but bulk
-- operations (markAllAsRead, deleteAllNotifications, the 30-day cleanup
-- cron) issue one SQL statement that touches many rows, and each touched
-- row produces a separate WAL → realtime event delivered to the connected
-- client. The fan-out per bulk op multiplies bytes far past what the
-- subscriber actually consumes.
--
-- Decision: drop notifications from the publication entirely. Push
-- notifications still fire from the database via pg_net → Expo Push API
-- (see migration 009), so a foregrounded user with the inbox open still
-- gets refreshed via the expo-notifications listener; a backgrounded user
-- gets the system push as before. The realtime stream was redundant.
--
-- See postmortem.md at the project root for full analysis.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  END IF;
END $$;
