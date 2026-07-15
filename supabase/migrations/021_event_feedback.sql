-- Migration: 021_event_feedback
-- Adds event feedback system: table, RLS, notification types, triggers, and scheduled requests.

-- ============================================================
-- 1. Create event_feedback table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id          SERIAL PRIMARY KEY,
  event_id    INT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT DEFAULT 'Anonim',
  rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  hours_played NUMERIC(4,1) NOT NULL CHECK (hours_played > 0 AND hours_played <= 24),
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event ON public.event_feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_event_feedback_user  ON public.event_feedback(user_id);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read feedback for events they participate in or organize
CREATE POLICY "Users can read feedback for their events"
  ON public.event_feedback FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_participants ep WHERE ep.event_id = event_feedback.event_id AND ep.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_feedback.event_id AND e.organizer_id = auth.uid()
    )
  );

-- INSERT: authenticated users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.event_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Expand notification type CHECK constraint
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'event_feedback_request', 'event_feedback_received',
    'checkin_nearby',
    'review_on_venue'
  ));

-- ============================================================
-- 3. Trigger: notify organizer when feedback is submitted
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_event_feedback_notification()
RETURNS TRIGGER AS $$
DECLARE
  reviewer TEXT;
  event_record RECORD;
BEGIN
  SELECT full_name INTO reviewer FROM public.profiles WHERE id = NEW.user_id;
  reviewer := COALESCE(reviewer, 'Cineva');

  SELECT id, title, organizer_id INTO event_record
  FROM public.events WHERE id = NEW.event_id;

  IF event_record IS NOT NULL AND event_record.organizer_id IS NOT NULL THEN
    PERFORM public.create_and_send_notification(
      event_record.organizer_id,
      NEW.user_id,
      'event_feedback_received',
      'Feedback eveniment',
      reviewer || ' a lăsat feedback la "' || COALESCE(event_record.title, 'eveniment') || '" (' || NEW.rating || '★).',
      jsonb_build_object('screen', '/(tabs)/events', 'eventId', NEW.event_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_feedback_created ON public.event_feedback;
CREATE TRIGGER on_event_feedback_created
  AFTER INSERT ON public.event_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_event_feedback_notification();

-- ============================================================
-- 4. Scheduled function: send feedback requests after events end
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_event_feedback_requests()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  participant RECORD;
  event_title TEXT;
BEGIN
  FOR event_record IN
    SELECT e.id, e.title, e.organizer_id, v.name AS venue_name
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE e.status != 'cancelled'
      -- Event ended within the last 48 hours
      AND COALESCE(e.ends_at, (e.starts_at::date + INTERVAL '1 day')) < NOW()
      AND COALESCE(e.ends_at, (e.starts_at::date + INTERVAL '1 day')) > NOW() - INTERVAL '48 hours'
  LOOP
    event_title := COALESCE(event_record.title, event_record.venue_name, 'Eveniment');

    FOR participant IN
      SELECT ep.user_id
      FROM public.event_participants ep
      WHERE ep.event_id = event_record.id
        -- Skip the organizer
        AND ep.user_id != event_record.organizer_id
        -- Skip if already notified
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = ep.user_id
            AND n.type = 'event_feedback_request'
            AND n.data->>'eventId' = event_record.id::text
        )
        -- Skip if feedback already submitted
        AND NOT EXISTS (
          SELECT 1 FROM public.event_feedback ef
          WHERE ef.event_id = event_record.id
            AND ef.user_id = ep.user_id
        )
    LOOP
      BEGIN
        INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
        VALUES (
          participant.user_id,
          event_record.organizer_id,
          'event_feedback_request',
          'Cum a fost?',
          'Lasă feedback pentru "' || event_title || '".',
          jsonb_build_object('screen', '/(protected)/event-feedback/' || event_record.id, 'eventId', event_record.id)
        );

        PERFORM public.send_push_notification(
          participant.user_id,
          'Cum a fost?',
          'Lasă feedback pentru "' || event_title || '".',
          jsonb_build_object('screen', '/(protected)/event-feedback/' || event_record.id, 'eventId', event_record.id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule hourly (only works on Supabase hosted with pg_cron)
DO $$
BEGIN
  PERFORM cron.schedule(
    'send-event-feedback-requests',
    '15 * * * *',
    $cron$ SELECT public.send_event_feedback_requests(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — event feedback requests must be triggered externally';
END $$;
