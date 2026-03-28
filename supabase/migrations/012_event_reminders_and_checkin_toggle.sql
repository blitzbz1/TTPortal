-- Migration: 012_event_reminders_and_checkin_toggle
-- 1. Scheduled function to send event reminders 24h before start
-- 2. Profile toggle for checkin notifications

-- ============================================================
-- 1. EVENT REMINDERS
-- Creates a function that finds events starting in the next 24h
-- and sends reminders to participants who haven't been reminded.
-- Should be called via pg_cron or Supabase Edge Function on a schedule.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  participant RECORD;
  event_title TEXT;
  time_str TEXT;
BEGIN
  FOR event_record IN
    SELECT e.id, e.title, e.starts_at, v.name AS venue_name
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE e.status IN ('open', 'confirmed')
      AND e.starts_at > NOW()
      AND e.starts_at <= NOW() + INTERVAL '24 hours'
  LOOP
    event_title := COALESCE(event_record.title, event_record.venue_name, 'Eveniment');
    time_str := to_char(event_record.starts_at AT TIME ZONE 'Europe/Bucharest', 'HH24:MI');

    FOR participant IN
      SELECT ep.user_id
      FROM public.event_participants ep
      WHERE ep.event_id = event_record.id
        -- Skip if already reminded for this event
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = ep.user_id
            AND n.type = 'event_reminder'
            AND n.data->>'event_id' = event_record.id::text
        )
    LOOP
      BEGIN
        INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
        VALUES (
          participant.user_id,
          NULL,
          'event_reminder',
          'Eveniment mâine',
          '"' || event_title || '" începe mâine la ' || time_str || '.',
          jsonb_build_object('screen', '/(tabs)/events', 'event_id', event_record.id)
        );

        PERFORM public.send_push_notification(
          participant.user_id,
          'Eveniment mâine',
          '"' || event_title || '" începe mâine la ' || time_str || '.',
          jsonb_build_object('screen', '/(tabs)/events', 'event_id', event_record.id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Don't fail the whole batch
      END;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable pg_cron if available (Supabase hosted has it pre-installed)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — event reminders must be triggered externally';
END $$;

-- Schedule: run every hour to catch events starting in the next 24h
-- (only works on Supabase hosted where pg_cron is available)
DO $$
BEGIN
  PERFORM cron.schedule(
    'send-event-reminders',
    '0 * * * *',  -- every hour
    'SELECT public.send_event_reminders()'
  );
  RAISE NOTICE 'Scheduled event reminders cron job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron — pg_cron not available';
END $$;

-- ============================================================
-- 2. CHECKIN NOTIFICATION TOGGLE
-- Add a profile preference to opt out of friend checkin notifications
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_friend_checkins BOOLEAN NOT NULL DEFAULT true;

-- Update the checkin trigger to respect this preference
CREATE OR REPLACE FUNCTION public.trigger_checkin_notification()
RETURNS TRIGGER AS $$
DECLARE
  checkin_user_name TEXT;
  venue_name TEXT;
  friend RECORD;
  friend_prefs BOOLEAN;
BEGIN
  SELECT full_name INTO checkin_user_name FROM public.profiles WHERE id = NEW.user_id;
  checkin_user_name := COALESCE(checkin_user_name, 'Cineva');

  SELECT name INTO venue_name FROM public.venues WHERE id = NEW.venue_id;
  venue_name := COALESCE(venue_name, 'o locație');

  -- Notify accepted friends who have checkin notifications enabled
  FOR friend IN
    SELECT CASE
      WHEN requester_id = NEW.user_id THEN addressee_id
      ELSE requester_id
    END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = NEW.user_id OR addressee_id = NEW.user_id)
  LOOP
    -- Check friend's notification preference
    SELECT notify_friend_checkins INTO friend_prefs
    FROM public.profiles WHERE id = friend.friend_id;

    IF COALESCE(friend_prefs, true) THEN
      PERFORM public.create_and_send_notification(
        friend.friend_id,
        NEW.user_id,
        'checkin_nearby',
        'Check-in prieten',
        checkin_user_name || ' a făcut check-in la "' || venue_name || '".',
        jsonb_build_object('screen', '/venue/' || NEW.venue_id, 'venueId', NEW.venue_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
