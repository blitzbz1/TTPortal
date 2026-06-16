-- F021 — Find Players directory + Challenge (migration 116).
-- Verifies: discoverable defaults off, the directory excludes friends, blocked
-- users, and non-discoverable users while listing discoverable strangers, and an
-- accepted Challenge spawns a private 2-person event.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(7);

-- A viewer; B discoverable stranger; C discoverable friend; D discoverable+blocked; E not discoverable.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('7c000000-0000-4000-8000-000000000001', 'f021-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('7c000000-0000-4000-8000-000000000002', 'f021-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('7c000000-0000-4000-8000-000000000003', 'f021-c@example.com', '{"full_name":"Cara"}'::jsonb),
  ('7c000000-0000-4000-8000-000000000004', 'f021-d@example.com', '{"full_name":"Dan"}'::jsonb),
  ('7c000000-0000-4000-8000-000000000005', 'f021-e@example.com', '{"full_name":"Eva"}'::jsonb);

UPDATE public.profiles SET discoverable = true
 WHERE id IN ('7c000000-0000-4000-8000-000000000002',
              '7c000000-0000-4000-8000-000000000003',
              '7c000000-0000-4000-8000-000000000004');

INSERT INTO public.friendships (requester_id, addressee_id, status)
VALUES ('7c000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000003', 'accepted');
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('7c000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000004');

-- ── act as A ────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '7c000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"7c000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.find_players() WHERE user_id = '7c000000-0000-4000-8000-000000000002'),
  'a discoverable stranger is listed');
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.find_players() WHERE user_id = '7c000000-0000-4000-8000-000000000003'),
  'an accepted friend is excluded');
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.find_players() WHERE user_id = '7c000000-0000-4000-8000-000000000004'),
  'a blocked user is excluded');
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.find_players() WHERE user_id = '7c000000-0000-4000-8000-000000000005'),
  'a non-discoverable user is excluded (discoverable defaults off)');

-- (5) A challenges B.
SELECT extensions.isnt(
  public.send_match_invite('7c000000-0000-4000-8000-000000000002', NULL, 'Best of 5?'),
  NULL, 'a challenge is sent');

RESET ROLE;

-- ── act as B: accept ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '7c000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"7c000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.isnt(
  public.accept_match_invite(
    (SELECT id FROM public.match_invites
     WHERE invitee_id = '7c000000-0000-4000-8000-000000000002' AND status = 'pending')),
  NULL, 'the invitee accepts and gets an event id');

RESET ROLE;

-- (7) the spawned event is private with both players.
SELECT extensions.is(
  (SELECT e.visibility::text || ':' ||
          (SELECT count(*)::int FROM public.event_participants ep WHERE ep.event_id = e.id)::text
   FROM public.events e
   WHERE e.organizer_id = '7c000000-0000-4000-8000-000000000001'
   ORDER BY e.id DESC LIMIT 1),
  'private:2',
  'an accepted challenge spawns a private 2-person event');

SELECT extensions.finish();
ROLLBACK;
