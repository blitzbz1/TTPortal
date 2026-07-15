-- Migration: 059_fix_event_visibility_recursion
-- Two issues are surfaced together because they share a fix path:
--
-- 1. Migration 058's event_invitations SELECT policy referenced events,
--    while the events SELECT policy references event_invitations — Postgres
--    detects the cycle at eval time and raises
--    "infinite recursion detected in policy for relation 'events'" on
--    inserts that round-trip through .select().single().
--
-- 2. Production already carried a legacy "Events are visible by privacy"
--    SELECT policy on events (added directly, not via migrations) keyed on
--    a legacy event_visibility TEXT column whose default is 'public'. Since
--    SELECT policies are OR'd, that policy's `event_visibility = 'public'`
--    branch granted everyone read access to every event regardless of the
--    new visibility ENUM, defeating private/friends visibility entirely.
--    The dormant `event_visibility` column, `event_invites` table, and
--    3-arg send_event_invites overload from that earlier attempt are left
--    in place — they're cruft but unused, safe to clean up separately.

-- 1. Break the RLS cycle. Invites are only ever created by the event
-- organizer through the send_event_invites RPC, which sets invited_by =
-- caller_id, so `invited_by = auth.uid()` reproduces the organizer-can-
-- read-invites-for-their-event guarantee without referencing events.
DROP POLICY IF EXISTS "Invitees can read own invites" ON public.event_invitations;
CREATE POLICY "Invitees can read own invites" ON public.event_invitations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR invited_by = auth.uid()
  );

-- 2. Drop the legacy SELECT policy so the new visibility-aware policy is
-- the sole gate. The legacy event_visibility column stays (no client code
-- writes to it) — once nothing references it, a follow-up migration can
-- drop the column.
DROP POLICY IF EXISTS "Events are visible by privacy" ON public.events;
