-- Migration: 015_event_updates
-- Add 'event_update' notification type and RPC function for organizer announcements.

-- 1. Add 'event_update' to the notifications type CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'checkin_nearby',
    'review_on_venue'
  ));

-- 2. RPC function: send an update to all event participants
CREATE OR REPLACE FUNCTION public.send_event_update(
  p_event_id INT,
  p_message TEXT
) RETURNS void AS $$
DECLARE
  caller_id UUID := auth.uid();
  event_record RECORD;
  caller_name TEXT;
  participant RECORD;
BEGIN
  -- Verify caller is the event organizer
  SELECT id, title, organizer_id
  INTO event_record
  FROM public.events
  WHERE id = p_event_id;

  IF event_record IS NULL OR event_record.organizer_id != caller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT full_name INTO caller_name FROM public.profiles WHERE id = caller_id;
  caller_name := COALESCE(caller_name, 'Cineva');

  -- Notify every participant (except the organizer)
  FOR participant IN
    SELECT user_id FROM public.event_participants WHERE event_id = p_event_id
  LOOP
    PERFORM public.create_and_send_notification(
      participant.user_id,
      caller_id,
      'event_update',
      'Actualizare eveniment',
      caller_name || ' · "' || COALESCE(event_record.title, 'eveniment') || '": ' || p_message,
      jsonb_build_object('screen', '/(tabs)/events', 'eventId', p_event_id)
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
