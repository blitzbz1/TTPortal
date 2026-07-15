-- Migration: 087_event_participants_rls
-- Participant lists mirror the parent event's visibility.
--
-- 058 made events visibility-aware (public / friends / private+invited),
-- but event_participants kept 004's SELECT USING (true) — anyone,
-- including anonymous, could enumerate attendees of a private event.
--
-- Instead of duplicating 058's visibility predicate here, the policy
-- delegates to a SECURITY INVOKER helper that simply checks whether the
-- caller can read the parent event — events RLS (058) applies inside it,
-- so participant visibility can never drift from event visibility.

CREATE OR REPLACE FUNCTION public.can_read_event(p_event_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id);
$$;

COMMENT ON FUNCTION public.can_read_event(bigint) IS
  'True when the calling role can read the event under events RLS (058). '
  'SECURITY INVOKER on purpose — it must see exactly what the caller sees.';

GRANT EXECUTE ON FUNCTION public.can_read_event(bigint) TO authenticated, anon;

DROP POLICY IF EXISTS "Event participants are publicly readable" ON public.event_participants;
DROP POLICY IF EXISTS "Participants visible with parent event" ON public.event_participants;

-- No TO clause (mirrors 004): anon keeps reading participants of events it
-- can read — i.e. public ones — so the public web event pages still render
-- avatar stacks. Self-rows stay visible even if event visibility changes
-- under the participant.
CREATE POLICY "Participants visible with parent event" ON public.event_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.can_read_event(event_id)
  );

NOTIFY pgrst, 'reload schema';
