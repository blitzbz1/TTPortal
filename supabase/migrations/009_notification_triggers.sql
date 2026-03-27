-- Migration: 009_notification_triggers
-- Database triggers that create in-app notifications AND send push notifications
-- via pg_net → Expo Push API when relevant events occur.

-- Enable pg_net for HTTP requests (pre-installed on Supabase hosted)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- ============================================================
-- Helper: send push notification via Expo Push API
-- Looks up all push tokens for a user and sends via pg_net.
-- Errors are caught so push failures never roll back the parent transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_recipient_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  token_record RECORD;
  payload JSONB;
BEGIN
  FOR token_record IN
    SELECT token FROM public.push_tokens WHERE user_id = p_recipient_id
  LOOP
    BEGIN
      payload := jsonb_build_object(
        'to', token_record.token,
        'title', p_title,
        'body', p_body,
        'data', p_data,
        'sound', 'default',
        'badge', (SELECT COUNT(*)::int FROM public.notifications WHERE recipient_id = p_recipient_id AND read = false)
      );

      PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json'
        ),
        body := payload
      );
    EXCEPTION WHEN OTHERS THEN
      -- Push failure must never block the parent transaction
      NULL;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Helper: create notification + send push
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_and_send_notification(
  p_recipient_id UUID,
  p_sender_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  -- Don't notify yourself
  IF p_recipient_id = p_sender_id THEN
    RETURN;
  END IF;

  -- Insert in-app notification
  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
  VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_data);

  -- Send push notification
  PERFORM public.send_push_notification(p_recipient_id, p_title, p_body, p_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 1. FRIENDSHIPS: friend_request (INSERT pending) & friend_accepted (UPDATE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_friendship_notification()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  recipient_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.requester_id;
    sender_name := COALESCE(sender_name, 'Cineva');

    PERFORM public.create_and_send_notification(
      NEW.addressee_id,
      NEW.requester_id,
      'friend_request',
      'Cerere de prietenie',
      sender_name || ' vrea să fie prietenul tău.',
      jsonb_build_object('screen', '/(protected)/friends', 'friendshipId', NEW.id)
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.addressee_id;
    sender_name := COALESCE(sender_name, 'Cineva');

    PERFORM public.create_and_send_notification(
      NEW.requester_id,
      NEW.addressee_id,
      'friend_accepted',
      'Cerere acceptată',
      sender_name || ' a acceptat cererea ta de prietenie.',
      jsonb_build_object('screen', '/(protected)/friends', 'friendshipId', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
CREATE TRIGGER on_friendship_change
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_friendship_notification();

-- ============================================================
-- 2. EVENT_PARTICIPANTS: event_joined (INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_event_participant_notification()
RETURNS TRIGGER AS $$
DECLARE
  participant_name TEXT;
  event_record RECORD;
BEGIN
  SELECT full_name INTO participant_name FROM public.profiles WHERE id = NEW.user_id;
  participant_name := COALESCE(participant_name, 'Cineva');

  SELECT e.id, e.title, e.organizer_id, v.name AS venue_name
  INTO event_record
  FROM public.events e
  LEFT JOIN public.venues v ON v.id = e.venue_id
  WHERE e.id = NEW.event_id;

  IF event_record IS NOT NULL AND event_record.organizer_id IS NOT NULL THEN
    PERFORM public.create_and_send_notification(
      event_record.organizer_id,
      NEW.user_id,
      'event_joined',
      'Participant nou',
      participant_name || ' s-a înscris la "' || COALESCE(event_record.title, event_record.venue_name, 'eveniment') || '".',
      jsonb_build_object('screen', '/(tabs)/events', 'eventId', NEW.event_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_participant_join ON public.event_participants;
CREATE TRIGGER on_event_participant_join
  AFTER INSERT ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_event_participant_notification();

-- ============================================================
-- 3. EVENTS: event_cancelled (UPDATE status to 'cancelled')
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_event_cancelled_notification()
RETURNS TRIGGER AS $$
DECLARE
  organizer_name TEXT;
  event_title TEXT;
  participant RECORD;
BEGIN
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    SELECT full_name INTO organizer_name FROM public.profiles WHERE id = NEW.organizer_id;
    organizer_name := COALESCE(organizer_name, 'Organizatorul');
    event_title := COALESCE(NEW.title, 'Eveniment');

    FOR participant IN
      SELECT user_id FROM public.event_participants WHERE event_id = NEW.id
    LOOP
      PERFORM public.create_and_send_notification(
        participant.user_id,
        NEW.organizer_id,
        'event_cancelled',
        'Eveniment anulat',
        '"' || event_title || '" a fost anulat de ' || organizer_name || '.',
        jsonb_build_object('screen', '/(tabs)/events', 'eventId', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_cancelled ON public.events;
CREATE TRIGGER on_event_cancelled
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_event_cancelled_notification();

-- ============================================================
-- 4. REVIEWS: review_on_venue (INSERT) — notify venue submitter
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_review_notification()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_name TEXT;
  venue_record RECORD;
BEGIN
  SELECT name, submitted_by INTO venue_record FROM public.venues WHERE id = NEW.venue_id;

  IF venue_record IS NOT NULL AND venue_record.submitted_by IS NOT NULL THEN
    reviewer_name := COALESCE(NEW.reviewer_name, 'Cineva');

    PERFORM public.create_and_send_notification(
      venue_record.submitted_by,
      NEW.user_id,
      'review_on_venue',
      'Recenzie nouă',
      reviewer_name || ' a scris o recenzie la "' || COALESCE(venue_record.name, 'locație') || '" (' || NEW.rating || '★).',
      jsonb_build_object('screen', '/venue/' || NEW.venue_id, 'venueId', NEW.venue_id, 'reviewId', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_review_notification();

-- ============================================================
-- 5. CHECKINS: checkin_nearby — notify friends checked in at same venue
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_checkin_notification()
RETURNS TRIGGER AS $$
DECLARE
  checkin_user_name TEXT;
  venue_name TEXT;
  friend RECORD;
BEGIN
  SELECT full_name INTO checkin_user_name FROM public.profiles WHERE id = NEW.user_id;
  checkin_user_name := COALESCE(checkin_user_name, 'Cineva');

  SELECT name INTO venue_name FROM public.venues WHERE id = NEW.venue_id;
  venue_name := COALESCE(venue_name, 'o locație');

  -- Notify accepted friends of this user
  FOR friend IN
    SELECT CASE
      WHEN requester_id = NEW.user_id THEN addressee_id
      ELSE requester_id
    END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = NEW.user_id OR addressee_id = NEW.user_id)
  LOOP
    PERFORM public.create_and_send_notification(
      friend.friend_id,
      NEW.user_id,
      'checkin_nearby',
      'Check-in prieten',
      checkin_user_name || ' a făcut check-in la "' || venue_name || '".',
      jsonb_build_object('screen', '/venue/' || NEW.venue_id, 'venueId', NEW.venue_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_checkin_created ON public.checkins;
CREATE TRIGGER on_checkin_created
  AFTER INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_checkin_notification();

-- ============================================================
-- 6. Enable Supabase Realtime on notifications table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
