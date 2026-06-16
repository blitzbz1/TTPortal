-- F020 — Open Play broadcast (migration 115).
-- Verifies: one-active-broadcast guard, public visibility opt-in (strangers see
-- public, not friends_only; friends see friends_only), "I'm in" join, host
-- convert-to-event with all participants, and the expiry sweep.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(9);

-- ── seed: A host, B stranger, C friend-of-A, D blocked-by-A ─────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('6b000000-0000-4000-8000-000000000001', 'f020-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('6b000000-0000-4000-8000-000000000002', 'f020-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('6b000000-0000-4000-8000-000000000003', 'f020-c@example.com', '{"full_name":"Cara"}'::jsonb),
  ('6b000000-0000-4000-8000-000000000004', 'f020-d@example.com', '{"full_name":"Dan"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Playville', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('OP Venue', 'parc_exterior', 'Playville',
        (SELECT id FROM public.cities WHERE name = 'Playville'), 'St 1', 44.0, 26.0, true);

INSERT INTO public.friendships (requester_id, addressee_id, status)
VALUES ('6b000000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000003', 'accepted');
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('6b000000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000004');

-- ── act as A (host) ─────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '6b000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"6b000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) host opens a public "now" broadcast.
SELECT extensions.isnt(
  public.create_play_intent((SELECT id FROM public.venues WHERE name='OP Venue'), 'now', 'Bring your bat', true),
  NULL, 'host creates a public now-broadcast');

-- (2) a second open broadcast is rejected (one-active guard).
SELECT extensions.throws_ok(
  format($q$ SELECT public.create_play_intent(%s, 'now', null, true) $q$,
         (SELECT id FROM public.venues WHERE name='OP Venue')),
  NULL, NULL, 'a host may only have one active broadcast');

RESET ROLE;

-- ── act as B (stranger) ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '6b000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"6b000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (3) a stranger sees the public broadcast.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.get_open_play((SELECT city_id FROM public.venues WHERE name='OP Venue'))
          WHERE host_id = '6b000000-0000-4000-8000-000000000001'),
  'a stranger sees a public broadcast');

-- (4) the stranger joins → count 1.
SELECT extensions.is(
  public.join_play_intent(
    (SELECT id FROM public.get_open_play((SELECT city_id FROM public.venues WHERE name='OP Venue'))
     WHERE host_id = '6b000000-0000-4000-8000-000000000001')),
  1, 'a join is recorded');

RESET ROLE;

-- ── act as A: convert to event ──────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '6b000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"6b000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.isnt(
  public.convert_play_intent_to_event(
    (SELECT id FROM public.play_intents WHERE host_id='6b000000-0000-4000-8000-000000000001' AND status='open'),
    'Pickup game'),
  NULL, 'host converts the broadcast into an event');

-- a fresh friends-only broadcast for the visibility checks below.
SELECT public.create_play_intent((SELECT id FROM public.venues WHERE name='OP Venue'), 'tonight', null, false);

RESET ROLE;

-- (6) the converted event has both the host and the joiner.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.event_participants ep
   JOIN public.events e ON e.id = ep.event_id
   WHERE e.organizer_id = '6b000000-0000-4000-8000-000000000001'),
  2, 'the converted event has host + joiner as participants');

-- ── visibility of friends_only ──────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '6b000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"6b000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
-- (7) a stranger does NOT see a friends_only broadcast.
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.get_open_play((SELECT city_id FROM public.venues WHERE name='OP Venue'))
              WHERE host_id = '6b000000-0000-4000-8000-000000000001'),
  'a stranger does not see a friends_only broadcast');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '6b000000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"6b000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
-- (8) an accepted friend DOES see the friends_only broadcast.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.get_open_play((SELECT city_id FROM public.venues WHERE name='OP Venue'))
          WHERE host_id = '6b000000-0000-4000-8000-000000000001'),
  'a friend sees a friends_only broadcast');
RESET ROLE;

-- (9) the expiry sweep closes a past-window broadcast.
UPDATE public.play_intents SET expires_at = now() - interval '1 hour'
 WHERE host_id = '6b000000-0000-4000-8000-000000000001' AND status = 'open';
SELECT public.expire_play_intents();
SELECT extensions.is(
  (SELECT count(*)::int FROM public.play_intents
   WHERE host_id = '6b000000-0000-4000-8000-000000000001' AND status = 'expired'),
  1, 'the expiry sweep closes a broadcast past its window');

SELECT extensions.finish();
ROLLBACK;
