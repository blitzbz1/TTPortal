-- Take TTPortal off Supabase Realtime entirely. Live surfaces (the inbox,
-- friend check-ins, event cancellations) all flow through pg_net + Expo
-- Push. No client opens a realtime channel; the publication should be
-- empty of public.* tables.
--
-- Background: migration 054 dropped public.notifications. A
-- pg_publication_tables check on 2026-05-03 (the day after the egress
-- spike was contained) surfaced two more entries:
--   * public.check_ins  — vestigial; the app uses public.checkins
--   * public.messages   — never queried by app code
-- Both were toggled on via the Supabase Studio "Replication" UI at some
-- point and forgotten. Each is a latent egress source: a single Studio
-- viewer or external consumer subscribing to one would resume the kind of
-- per-row WAL fan-out that produced the Apr 28-30 spike.
--
-- See postmortem.md for the original incident.

-- ============================================================
-- 1. Drop every remaining public.* table from supabase_realtime
-- ============================================================
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER PUBLICATION supabase_realtime DROP TABLE %I.%I',
      rec.schemaname, rec.tablename
    );
    RAISE NOTICE 'Removed %.% from supabase_realtime', rec.schemaname, rec.tablename;
  END LOOP;
END $$;

-- ============================================================
-- 2. Broaden the publication guard installed in migration 055
-- ============================================================
-- The event trigger object (guard_notifications_publication) stays as-is
-- and keeps firing on ALTER PUBLICATION; we just swap the function it
-- calls so it now blocks ANY public.* table from being added to
-- supabase_realtime, not only notifications. This matches project policy:
-- TTPortal does not use Supabase Realtime.
--
-- To intentionally re-enable realtime on a specific table (after auditing
-- bulk write patterns that fan out per-row events), drop the trigger:
--   DROP EVENT TRIGGER guard_notifications_publication;

CREATE OR REPLACE FUNCTION public.guard_realtime_publication()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  offending TEXT;
BEGIN
  SELECT schemaname || '.' || tablename INTO offending
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
  LIMIT 1;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'TTPortal does not use Supabase Realtime; % cannot be added to the '
      'supabase_realtime publication. Live updates flow through pg_net + '
      'Expo Push. See postmortem.md and migrations 054-056. To override, '
      'DROP EVENT TRIGGER guard_notifications_publication first.',
      offending;
  END IF;
END;
$$;

-- ============================================================
-- 3. Document the policy on the two orphan tables (if they still exist)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.check_ins') IS NOT NULL THEN
    COMMENT ON TABLE public.check_ins IS
      'Vestigial — superseded by public.checkins. NOT in supabase_realtime '
      'publication; see migration 056. TTPortal does not use Supabase Realtime.';
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    COMMENT ON TABLE public.messages IS
      'NOT in supabase_realtime publication; see migration 056. TTPortal '
      'does not use Supabase Realtime — live updates flow through '
      'pg_net + Expo Push.';
  END IF;
END $$;
