-- Add a closed event state for organizers who want to stop new joins without
-- marking the event as completed.

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('open', 'confirmed', 'closed', 'cancelled', 'completed'));

DROP POLICY IF EXISTS "Users can join events" ON public.event_participants;
CREATE POLICY "Users can join events" ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.status IN ('open', 'confirmed')
    )
  );
