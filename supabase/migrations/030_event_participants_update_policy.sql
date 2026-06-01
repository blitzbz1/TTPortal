-- Migration: 030_event_participants_update_policy
-- Allow a participant to update their own row (e.g. set hours_played).

DROP POLICY IF EXISTS "Users can update own participation" ON public.event_participants;
CREATE POLICY "Users can update own participation"
  ON public.event_participants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
