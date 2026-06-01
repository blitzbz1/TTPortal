-- Migration: 014_event_invites
-- Add 'event_invite' notification type and RPC function for sending event invitations.

-- 1. Add 'event_invite' to the notifications type CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite',
    'checkin_nearby',
    'review_on_venue'
  ));

-- 2. RPC function: send event invitations to a list of friends
CREATE OR REPLACE FUNCTION public.send_event_invites(
  p_event_id INT,
  p_friend_ids UUID[]
) RETURNS void AS $$
DECLARE
  caller_id UUID := auth.uid();
  event_record RECORD;
  caller_name TEXT;
  friend_id UUID;
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

  FOREACH friend_id IN ARRAY p_friend_ids
  LOOP
    -- Only invite accepted friends
    IF EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = caller_id AND addressee_id = friend_id)
          OR (requester_id = friend_id AND addressee_id = caller_id))
    ) THEN
      -- Skip if already invited (unread notification for same event)
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE recipient_id = friend_id
          AND type = 'event_invite'
          AND (data->>'eventId')::int = p_event_id
          AND read = false
      ) THEN
        PERFORM public.create_and_send_notification(
          friend_id,
          caller_id,
          'event_invite',
          'Invitație la eveniment',
          caller_name || ' te-a invitat la "' || COALESCE(event_record.title, 'eveniment') || '".',
          jsonb_build_object('screen', '/(tabs)/events', 'eventId', p_event_id)
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
