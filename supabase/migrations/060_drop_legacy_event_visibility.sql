-- Migration: 060_drop_legacy_event_visibility
-- Removes the dormant legacy visibility/invites bits that pre-existed in
-- production from an earlier implementation attempt:
--   * event_visibility TEXT column on events (with its CHECK constraint)
--   * event_invites table (with its RLS policies + FKs)
--   * 3-arg send_event_invites(int, uuid[], uuid) overload that wrote into
--     event_invites
--
-- After migration 059 dropped the legacy SELECT policy that read
-- event_visibility, none of these are referenced by anything still in use:
-- client code calls only the 2-arg send_event_invites overload from 058,
-- and no view/trigger/function/policy in the schema references the legacy
-- bits any longer.
--
-- Defensive backfills run first so any rows still living in the legacy
-- column/table are mirrored onto the new visibility ENUM / event_invitations
-- table before the drops fire. Both backfills are idempotent — safe to
-- re-run, and a no-op when the legacy storage is empty.

-- 1. Mirror any non-default legacy visibility values onto the new ENUM.
-- Only overwrites rows still at the new-column default ('public') so we
-- never clobber values set through the new code path.
UPDATE public.events
   SET visibility = event_visibility::public.event_visibility
 WHERE event_visibility IN ('friends', 'private')
   AND visibility = 'public';

-- 2. Mirror any legacy invites onto the new event_invitations table. The
-- legacy schema used (inviter_id, invitee_id); the new schema uses
-- (invited_by, user_id). created_at maps to invited_at.
INSERT INTO public.event_invitations (event_id, user_id, invited_by, invited_at)
SELECT event_id, invitee_id, inviter_id, created_at
  FROM public.event_invites
ON CONFLICT (event_id, user_id) DO NOTHING;

-- 3. Drop the dormant 3-arg send_event_invites overload. It targets
-- event_invites (going away in this migration); the 2-arg overload from
-- migration 058 is the one the client now calls.
DROP FUNCTION IF EXISTS public.send_event_invites(integer, uuid[], uuid);

-- 4. Drop the legacy event_invites table. CASCADE removes its RLS
-- policies and the id sequence; the events / profiles FKs are dropped
-- automatically because they live on event_invites.
DROP TABLE IF EXISTS public.event_invites CASCADE;

-- 5. Drop the legacy event_visibility column. The
-- events_event_visibility_check CHECK constraint drops with the column.
ALTER TABLE public.events DROP COLUMN IF EXISTS event_visibility;
