-- F023 — direct messages (migration 118 + 136 staff-mediated restriction).
-- Under 136 the DM channel is staff-mediated:
--   * only admins/moderators may START a conversation (with any user);
--   * a regular user may SEND only into a thread whose other participant is
--     staff (a reply); user<->user sends are rejected, incl. legacy threads.
-- Verifies that initiate/reply matrix + the can_send_in_thread UI gate.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(10);

-- Ada = admin, Mo = moderator, U1/U2 = regular users.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('8d000000-0000-4000-8000-0000000000a1', 'f023-ada@example.com', '{"full_name":"Ada"}'::jsonb),
  ('8d000000-0000-4000-8000-0000000000b2', 'f023-mo@example.com',  '{"full_name":"Mo"}'::jsonb),
  ('8d000000-0000-4000-8000-000000000011', 'f023-u1@example.com',  '{"full_name":"U1"}'::jsonb),
  ('8d000000-0000-4000-8000-000000000012', 'f023-u2@example.com',  '{"full_name":"U2"}'::jsonb);

UPDATE public.profiles SET is_admin     = true WHERE id = '8d000000-0000-4000-8000-0000000000a1';
UPDATE public.profiles SET is_moderator = true WHERE id = '8d000000-0000-4000-8000-0000000000b2';

-- A legacy peer thread (U1<->U2) as could have existed before 136. Force-insert
-- as owner since get_or_create_dm_thread now blocks regular users.
INSERT INTO public.dm_threads (user_a, user_b)
VALUES (LEAST('8d000000-0000-4000-8000-000000000011'::uuid, '8d000000-0000-4000-8000-000000000012'::uuid),
        GREATEST('8d000000-0000-4000-8000-000000000011'::uuid, '8d000000-0000-4000-8000-000000000012'::uuid));

-- ── act as U1 (regular) ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '8d000000-0000-4000-8000-000000000011', true);
SELECT set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) a regular user cannot start a conversation with another regular user.
SELECT extensions.throws_ok(
  $q$ SELECT public.get_or_create_dm_thread('8d000000-0000-4000-8000-000000000012') $q$,
  NULL, 'cannot_message', 'regular user cannot initiate a DM to another regular user');

-- (2) ...nor with an admin (only staff initiate).
SELECT extensions.throws_ok(
  $q$ SELECT public.get_or_create_dm_thread('8d000000-0000-4000-8000-0000000000a1') $q$,
  NULL, 'cannot_message', 'regular user cannot initiate a DM even toward an admin');

-- (3) a regular user cannot send in a legacy user<->user thread.
SELECT extensions.throws_ok(
  $q$ SELECT public.send_dm(
        (SELECT id FROM public.dm_threads
          WHERE user_a = LEAST('8d000000-0000-4000-8000-000000000011'::uuid,'8d000000-0000-4000-8000-000000000012'::uuid)
            AND user_b = GREATEST('8d000000-0000-4000-8000-000000000011'::uuid,'8d000000-0000-4000-8000-000000000012'::uuid)),
        'hello') $q$,
  NULL, 'cannot_message', 'regular user cannot send in a user<->user thread');

-- (4) can_send_in_thread is false for that read-only legacy thread.
SELECT extensions.ok(
  NOT public.can_send_in_thread(
    (SELECT id FROM public.dm_threads
      WHERE user_a = LEAST('8d000000-0000-4000-8000-000000000011'::uuid,'8d000000-0000-4000-8000-000000000012'::uuid)
        AND user_b = GREATEST('8d000000-0000-4000-8000-000000000011'::uuid,'8d000000-0000-4000-8000-000000000012'::uuid))),
  'can_send_in_thread = false in a user<->user thread');

RESET ROLE;

-- ── act as Ada (admin) ───────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '8d000000-0000-4000-8000-0000000000a1', true);
SELECT set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (5) an admin can open a conversation with any user.
SELECT extensions.isnt(
  public.get_or_create_dm_thread('8d000000-0000-4000-8000-000000000011'),
  NULL, 'admin can initiate a DM to a regular user');

-- (6) and send in it.
SELECT extensions.isnt(
  public.send_dm(
    public.get_or_create_dm_thread('8d000000-0000-4000-8000-000000000011'), 'Hello from staff'),
  NULL, 'admin can send in the thread they opened');

RESET ROLE;

-- ── act as Mo (moderator) ────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '8d000000-0000-4000-8000-0000000000b2', true);
SELECT set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (7) a moderator (not just an admin) can also initiate.
SELECT extensions.isnt(
  public.get_or_create_dm_thread('8d000000-0000-4000-8000-000000000012'),
  NULL, 'moderator can initiate a DM');

RESET ROLE;

-- ── act as U1 (regular) replying to the admin's thread ───────────────────────
SELECT set_config('request.jwt.claim.sub', '8d000000-0000-4000-8000-000000000011', true);
SELECT set_config('request.jwt.claims', '{"sub":"8d000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (8) can_send_in_thread is true in the admin-initiated thread.
SELECT extensions.ok(
  public.can_send_in_thread(
    (SELECT id FROM public.dm_threads
      WHERE user_a = LEAST('8d000000-0000-4000-8000-0000000000a1'::uuid,'8d000000-0000-4000-8000-000000000011'::uuid)
        AND user_b = GREATEST('8d000000-0000-4000-8000-0000000000a1'::uuid,'8d000000-0000-4000-8000-000000000011'::uuid))),
  'can_send_in_thread = true when the other participant is staff');

-- (9) a regular user CAN reply in a thread whose other party is an admin.
SELECT extensions.isnt(
  public.send_dm(
    (SELECT id FROM public.dm_threads
      WHERE user_a = LEAST('8d000000-0000-4000-8000-0000000000a1'::uuid,'8d000000-0000-4000-8000-000000000011'::uuid)
        AND user_b = GREATEST('8d000000-0000-4000-8000-0000000000a1'::uuid,'8d000000-0000-4000-8000-000000000011'::uuid)),
    'thanks!'),
  NULL, 'regular user can reply to staff in a staff-initiated thread');

-- (10) but still cannot initiate a new conversation.
SELECT extensions.throws_ok(
  $q$ SELECT public.get_or_create_dm_thread('8d000000-0000-4000-8000-0000000000b2') $q$,
  NULL, 'cannot_message', 'regular user still cannot initiate (even to a moderator)');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
