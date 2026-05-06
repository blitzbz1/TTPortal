-- Migration: 058_event_visibility
-- Adds three-level visibility for events (public / friends / private) with
-- RLS-enforced access. Public is the existing behaviour. Friends-only is
-- visible to anyone in an accepted friendship with the organizer at view
-- time. Private is visible only to users explicitly invited via the
-- send_event_invites RPC, tracked in a new event_invitations table that
-- serves as the security source of truth (notifications can be dismissed).
--
-- Backfill: existing events become 'public' so behaviour is unchanged.
-- New events also default to 'public' — clients opt in to friends / private
-- explicitly via the visibility selector.

-- 1. Visibility enum
DO $$ BEGIN
  CREATE TYPE public.event_visibility AS ENUM ('public', 'friends', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add visibility column with 'public' as the column default for both
-- existing rows (backfill) and future inserts.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility public.event_visibility NOT NULL DEFAULT 'public';

-- 3. event_invitations: source of truth for who can see a private event.
-- Notifications can be deleted/dismissed and are unsuitable for access
-- control on their own.
CREATE TABLE IF NOT EXISTS public.event_invitations (
  event_id INT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- The PK covers (event_id, user_id) lookups used by the events RLS subquery.
-- This index supports the inverse direction (find all invites for a user).
CREATE INDEX IF NOT EXISTS idx_event_invitations_user
  ON public.event_invitations(user_id);

-- 4. RLS for event_invitations: invitee sees own rows; organizer sees all
-- rows for their events. INSERT/DELETE are handled via the RPC
-- (SECURITY DEFINER bypasses RLS), so no INSERT/DELETE policies are needed.
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitees can read own invites" ON public.event_invitations;
CREATE POLICY "Invitees can read own invites" ON public.event_invitations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invitations.event_id AND e.organizer_id = auth.uid()
    )
  );

-- 5. Replace events SELECT policy with visibility-aware version.
DROP POLICY IF EXISTS "Events are publicly readable" ON public.events;

CREATE POLICY "Events visibility-aware select" ON public.events
  FOR SELECT
  USING (
    visibility = 'public'
    OR organizer_id = auth.uid()
    OR (
      visibility = 'friends' AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = auth.uid() AND f.addressee_id = events.organizer_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = events.organizer_id)
          )
      )
    )
    OR (
      visibility = 'private' AND EXISTS (
        SELECT 1 FROM public.event_invitations ei
        WHERE ei.event_id = events.id AND ei.user_id = auth.uid()
      )
    )
  );

-- 6. Update send_event_invites: in addition to the existing notification,
-- write into event_invitations for private events so the recipient gains
-- access. For public/friends events the access is already granted by the
-- visibility rules, so we only write the notification (avoids bloating the
-- table with redundant rows for events that didn't need invitations).
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
  SELECT id, title, organizer_id, visibility
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
      -- Grant access for private events (idempotent)
      IF event_record.visibility = 'private' THEN
        INSERT INTO public.event_invitations (event_id, user_id, invited_by)
        VALUES (p_event_id, friend_id, caller_id)
        ON CONFLICT (event_id, user_id) DO NOTHING;
      END IF;

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
