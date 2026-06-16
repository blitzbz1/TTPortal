-- F023 — direct messages (migration 118).
-- Verifies the can_message gate (friends + shared-event allowed; strangers and
-- blocked users barred), thread creation, sending, and that a barred pair
-- cannot open a thread.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(7);

-- A; B friend; C stranger; D shares an event with A; E blocked by A.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('8d000000-0000-4000-8000-000000000001', 'f023-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('8d000000-0000-4000-8000-000000000002', 'f023-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('8d000000-0000-4000-8000-000000000003', 'f023-c@example.com', '{"full_name":"Cara"}'::jsonb),
  ('8d000000-0000-4000-8000-000000000004', 'f023-d@example.com', '{"full_name":"Dan"}'::jsonb),
  ('8d000000-0000-4000-8000-000000000005', 'f023-e@example.com', '{"full_name":"Eva"}'::jsonb);

INSERT INTO public.friendships (requester_id, addressee_id, status)
VALUES ('8d000000-0000-4000-8000-000000000001', '8d000000-0000-4000-8000-000000000002', 'accepted');
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('8d000000-0000-4000-8000-000000000001', '8d000000-0000-4000-8000-000000000005');

-- A shared event between A and D.
INSERT INTO public.events (title, organizer_id, starts_at)
VALUES ('Shared', '8d000000-0000-4000-8000-000000000001', now() + interval '1 day');
INSERT INTO public.event_participants (event_id, user_id)
SELECT (SELECT id FROM public.events WHERE title = 'Shared'), u
FROM (VALUES ('8d000000-0000-4000-8000-000000000001'::uuid),
             ('8d000000-0000-4000-8000-000000000004'::uuid)) s(u);

-- ── act as A ────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '8d000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(public.can_message('8d000000-0000-4000-8000-000000000002'), 'can message an accepted friend');
SELECT extensions.ok(NOT public.can_message('8d000000-0000-4000-8000-000000000003'), 'cannot message a stranger');
SELECT extensions.ok(public.can_message('8d000000-0000-4000-8000-000000000004'), 'can message a shared-event participant');
SELECT extensions.ok(NOT public.can_message('8d000000-0000-4000-8000-000000000005'), 'cannot message a blocked user');

-- (5) open a thread with the friend.
SELECT extensions.isnt(
  public.get_or_create_dm_thread('8d000000-0000-4000-8000-000000000002'),
  NULL, 'a thread is created with an eligible user');

-- (6) send a message into it.
SELECT extensions.isnt(
  public.send_dm(
    public.get_or_create_dm_thread('8d000000-0000-4000-8000-000000000002'), 'Saturday 10am?'),
  NULL, 'a message is sent');

-- (7) a barred pair cannot open a thread.
SELECT extensions.throws_ok(
  $q$ SELECT public.get_or_create_dm_thread('8d000000-0000-4000-8000-000000000003') $q$,
  NULL, NULL, 'opening a thread with an ineligible user is rejected');

SELECT extensions.finish();
ROLLBACK;
