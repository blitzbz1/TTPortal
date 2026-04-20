-- Migration: 029_participant_hours
-- Moves `hours_played` from event_feedback onto event_participants so every
-- participant (including the organizer) can log hours without coupling it to
-- rating/review submission.

ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS hours_played NUMERIC(4,1) NOT NULL DEFAULT 0
    CHECK (hours_played >= 0 AND hours_played <= 24);

-- Backfill from existing event_feedback rows
UPDATE public.event_participants ep
SET hours_played = ef.hours_played
FROM public.event_feedback ef
WHERE ep.event_id = ef.event_id
  AND ep.user_id = ef.user_id
  AND ef.hours_played IS NOT NULL;

-- Backfill for organizers who logged hours via feedback but aren't in participants
INSERT INTO public.event_participants (event_id, user_id, hours_played)
SELECT ef.event_id, ef.user_id, ef.hours_played
FROM public.event_feedback ef
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_participants ep
  WHERE ep.event_id = ef.event_id AND ep.user_id = ef.user_id
)
ON CONFLICT (event_id, user_id) DO NOTHING;

ALTER TABLE public.event_feedback
  DROP COLUMN IF EXISTS hours_played;
