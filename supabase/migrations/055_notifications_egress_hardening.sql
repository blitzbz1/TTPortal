-- Defense-in-depth follow-ups to migration 054 (drop notifications from
-- supabase_realtime publication). Goal: make a future egress overflow
-- structurally hard to cause, not just hard to notice.
--
-- Three changes:
--   1. Pin REPLICA IDENTITY to DEFAULT on notifications. If the table is
--      ever re-added to a logical-decoding publication, DELETE/UPDATE
--      events ship only the primary key + new row, not the full prior row.
--      Caps per-event payload size to ~the row itself instead of 2x.
--   2. Refactor the two fan-out triggers (event cancellation, friend
--      check-in) to bulk-INSERT one row per recipient via INSERT…SELECT
--      instead of looping create_and_send_notification(). Same end state,
--      one DML statement instead of N, and pushes are dispatched in a
--      separate batched loop. Smaller WAL footprint per cancellation/
--      check-in and noticeably faster on heavy events.
--   3. Event trigger that rejects any future ALTER PUBLICATION that
--      re-adds public.notifications to supabase_realtime. The lesson from
--      the Apr 28-30 spike is that the table cannot be in the publication
--      while bulk operations exist on it; the guard makes that policy
--      machine-enforced rather than tribal knowledge.

-- ============================================================
-- 1. REPLICA IDENTITY DEFAULT (explicit)
-- ============================================================
ALTER TABLE public.notifications REPLICA IDENTITY DEFAULT;

COMMENT ON TABLE public.notifications IS
  'In-app notification feed. NOT in supabase_realtime publication — see '
  'migration 054 and postmortem.md. Bulk operations (markAllAsRead, '
  'cleanup_old_notifications, fan-out triggers) would generate per-row '
  'WebSocket events scaling with row count, blowing up Realtime egress.';

-- ============================================================
-- 2a. Refactor: trigger_event_cancelled_notification — bulk insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_event_cancelled_notification()
RETURNS TRIGGER AS $$
DECLARE
  organizer_name TEXT;
  event_title    TEXT;
  body_text      TEXT;
  data_json      JSONB;
  participant    RECORD;
BEGIN
  IF OLD.status = 'cancelled' OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO organizer_name FROM public.profiles WHERE id = NEW.organizer_id;
  organizer_name := COALESCE(organizer_name, 'Organizatorul');
  event_title    := COALESCE(NEW.title, 'Eveniment');
  body_text      := '"' || event_title || '" a fost anulat de ' || organizer_name || '.';
  data_json      := jsonb_build_object('screen', '/(tabs)/events', 'eventId', NEW.id);

  -- One bulk insert. NOT NULL recipients only; skip self-notify (the
  -- organizer is also a participant if they auto-joined).
  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
  SELECT ep.user_id,
         NEW.organizer_id,
         'event_cancelled',
         'Eveniment anulat',
         body_text,
         data_json
  FROM public.event_participants ep
  WHERE ep.event_id = NEW.id
    AND ep.user_id IS NOT NULL
    AND ep.user_id <> COALESCE(NEW.organizer_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Pushes are async via pg_net.http_post; loop is unavoidable until we
  -- batch via Expo's bulk-push endpoint, but each call is a queued HTTP
  -- request and does not contribute to Realtime egress.
  FOR participant IN
    SELECT user_id
    FROM public.event_participants
    WHERE event_id = NEW.id
      AND user_id IS NOT NULL
      AND user_id <> COALESCE(NEW.organizer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    PERFORM public.send_push_notification(
      participant.user_id,
      'Eveniment anulat',
      body_text,
      data_json
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2b. Refactor: trigger_checkin_notification — bulk insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_checkin_notification()
RETURNS TRIGGER AS $$
DECLARE
  checkin_user_name TEXT;
  venue_name        TEXT;
  body_text         TEXT;
  data_json         JSONB;
  friend            RECORD;
BEGIN
  SELECT full_name INTO checkin_user_name FROM public.profiles WHERE id = NEW.user_id;
  checkin_user_name := COALESCE(checkin_user_name, 'Cineva');

  SELECT name INTO venue_name FROM public.venues WHERE id = NEW.venue_id;
  venue_name := COALESCE(venue_name, 'o locație');

  body_text := checkin_user_name || ' a făcut check-in la "' || venue_name || '".';
  data_json := jsonb_build_object('screen', '/venue/' || NEW.venue_id, 'venueId', NEW.venue_id);

  -- One bulk insert covering every accepted friend.
  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
  SELECT
    CASE WHEN f.requester_id = NEW.user_id THEN f.addressee_id ELSE f.requester_id END,
    NEW.user_id,
    'checkin_nearby',
    'Check-in prieten',
    body_text,
    data_json
  FROM public.friendships f
  WHERE f.status = 'accepted'
    AND (f.requester_id = NEW.user_id OR f.addressee_id = NEW.user_id);

  -- Push fan-out (out-of-band).
  FOR friend IN
    SELECT CASE
      WHEN requester_id = NEW.user_id THEN addressee_id
      ELSE requester_id
    END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = NEW.user_id OR addressee_id = NEW.user_id)
  LOOP
    PERFORM public.send_push_notification(
      friend.friend_id,
      'Check-in prieten',
      body_text,
      data_json
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Event trigger guard — block ALTER PUBLICATION re-adding notifications
-- ============================================================
-- The check runs at ddl_command_end for ALTER PUBLICATION statements. If
-- public.notifications appears in supabase_realtime after the DDL, the
-- transaction is rolled back. This catches both `ALTER PUBLICATION
-- supabase_realtime ADD TABLE public.notifications` and `... ADD TABLES IN
-- SCHEMA public` style statements.
--
-- To intentionally re-add notifications (e.g. once bulk operations have
-- been re-architected), drop the event trigger first:
--   DROP EVENT TRIGGER guard_notifications_publication;

CREATE OR REPLACE FUNCTION public.guard_realtime_publication()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    RAISE EXCEPTION
      'public.notifications must not be in the supabase_realtime publication. '
      'See postmortem.md and migrations 054/055. To override, DROP EVENT '
      'TRIGGER guard_notifications_publication first.';
  END IF;
END;
$$;

DO $$
BEGIN
  DROP EVENT TRIGGER IF EXISTS guard_notifications_publication;
  CREATE EVENT TRIGGER guard_notifications_publication
    ON ddl_command_end
    WHEN TAG IN ('ALTER PUBLICATION')
    EXECUTE FUNCTION public.guard_realtime_publication();
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Some Supabase tiers run migrations as a non-superuser that can't
    -- create event triggers. Surface a NOTICE instead of failing the
    -- whole migration; the table-comment + postmortem still document the
    -- policy, and migration 054 is what actually keeps egress at zero.
    RAISE NOTICE 'guard_notifications_publication not installed (insufficient privilege). Policy is documented in COMMENT ON TABLE public.notifications.';
END $$;
