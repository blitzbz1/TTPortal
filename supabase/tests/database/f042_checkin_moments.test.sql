-- F042 — Session moments (migration 125).
-- Verifies: one moment per check-in (a second post_checkin_moment for the same
-- check-in REPLACES, count stays 1); soft delete hides the moment from
-- get_venue_moments; a non-owner cannot directly SELECT another user's moment
-- row (RLS read-own); get_venue_moments block-filters a blocked author;
-- content_reports CHECK accepts 'checkin_moment' (lives_ok) + rejects a bogus
-- type (throws_ok 23514); a friend's moment appears in get_friend_feed.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(11);

-- ── seed: A author, B friend-of-A viewer, C stranger/blocked ────────────────
-- (the on_auth_user_created trigger auto-creates each profile row.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('e0420000-0000-4000-8000-000000000001', 'f042-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('e0420000-0000-4000-8000-000000000002', 'f042-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('e0420000-0000-4000-8000-000000000003', 'f042-c@example.com', '{"full_name":"Cara"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Momentville', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Moment Venue', 'sala_indoor', 'Momentville',
        (SELECT id FROM public.cities WHERE name = 'Momentville'), 'St 1', 44.0, 26.0, true);
-- A second venue: used to prove a moment can't be stamped to a venue other than
-- the check-in's own (post_checkin_moment derives venue from the check-in).
INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Other Venue', 'sala_indoor', 'Momentville',
        (SELECT id FROM public.cities WHERE name = 'Momentville'), 'St 2', 44.1, 26.1, true);

-- A and B are accepted friends (so A's moment shows in B's friend feed).
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES
  ('e0420000-0000-4000-8000-000000000001', 'e0420000-0000-4000-8000-000000000002', 'accepted');

-- A has a check-in at the venue (moments attach to a check-in).
INSERT INTO public.checkins (user_id, venue_id, started_at)
VALUES ('e0420000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Moment Venue'),
        now());

-- ── act as A (author) ───────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'e0420000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"e0420000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) A posts a moment for the check-in.
SELECT extensions.isnt(
  public.post_checkin_moment(
    (SELECT id FROM public.checkins WHERE user_id='e0420000-0000-4000-8000-000000000001'),
    (SELECT id FROM public.venues WHERE name='Moment Venue'),
    'https://cdn/moments/a/1.jpg', 'first shot'),
  NULL, 'post_checkin_moment creates a moment');

-- (2) Posting AGAIN for the same check-in REPLACES (one moment per check-in).
SELECT public.post_checkin_moment(
  (SELECT id FROM public.checkins WHERE user_id='e0420000-0000-4000-8000-000000000001'),
  (SELECT id FROM public.venues WHERE name='Moment Venue'),
  'https://cdn/moments/a/2.jpg', 'second shot');
SELECT extensions.is(
  (SELECT count(*)::int FROM public.checkin_moments
   WHERE checkin_id = (SELECT id FROM public.checkins WHERE user_id='e0420000-0000-4000-8000-000000000001')),
  1, 're-posting for the same check-in replaces (count stays 1)');

-- (3) The moment shows in get_venue_moments for the venue.
SELECT extensions.is(
  jsonb_array_length(public.get_venue_moments((SELECT id FROM public.venues WHERE name='Moment Venue'), 12)),
  1, 'get_venue_moments returns the live moment');

-- (4) Posting a moment for a check-in the caller does NOT own is rejected.
SELECT extensions.throws_ok(
  format($q$ SELECT public.post_checkin_moment(99999, %s, 'https://cdn/x.jpg', NULL) $q$,
         (SELECT id FROM public.venues WHERE name='Moment Venue')),
  NULL, 'checkin not found or not yours', 'cannot attach a moment to a foreign / missing check-in');

-- (4b) post_checkin_moment with a venue that isn't the check-in's own venue is
-- rejected (the venue is derived from the owned check-in, not trusted from the
-- argument — guards UGC venue-spoofing).
SELECT extensions.throws_ok(
  format($q$ SELECT public.post_checkin_moment(%s, %s, 'https://cdn/x.jpg', NULL) $q$,
         (SELECT id FROM public.checkins WHERE user_id='e0420000-0000-4000-8000-000000000001'),
         (SELECT id FROM public.venues WHERE name='Other Venue')),
  NULL, 'venue mismatch', 'cannot stamp a moment to a venue other than the check-in''s');

-- (5) Author soft-delete hides the moment from get_venue_moments.
SELECT public.delete_checkin_moment(
  (SELECT id FROM public.checkin_moments
   WHERE checkin_id = (SELECT id FROM public.checkins WHERE user_id='e0420000-0000-4000-8000-000000000001')));
SELECT extensions.is(
  jsonb_array_length(public.get_venue_moments((SELECT id FROM public.venues WHERE name='Moment Venue'), 12)),
  0, 'soft-deleted moment is hidden from get_venue_moments');

RESET ROLE;

-- ── re-post a fresh live moment for the remaining cross-actor checks ─────────
-- (delete set deleted_at; ON CONFLICT re-post clears it back to NULL.)
SELECT set_config('request.jwt.claim.sub', 'e0420000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"e0420000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT public.post_checkin_moment(
  (SELECT id FROM public.checkins WHERE user_id='e0420000-0000-4000-8000-000000000001'),
  (SELECT id FROM public.venues WHERE name='Moment Venue'),
  'https://cdn/moments/a/3.jpg', 'back live');
RESET ROLE;

-- ── act as C (stranger) ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'e0420000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"e0420000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (6) A non-owner cannot directly SELECT another user's moment row (read-own RLS).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.checkin_moments),
  0, 'a non-owner sees no checkin_moments rows via RLS');

-- C blocks A: A's moment must drop out of get_venue_moments for C (RPC-layer filter).
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('e0420000-0000-4000-8000-000000000003', 'e0420000-0000-4000-8000-000000000001');

-- (7) get_venue_moments block-filters the blocked author.
SELECT extensions.is(
  jsonb_array_length(public.get_venue_moments((SELECT id FROM public.venues WHERE name='Moment Venue'), 12)),
  0, 'get_venue_moments block-filters a blocked author');

RESET ROLE;

-- ── act as B (friend of A) ──────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'e0420000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"e0420000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (8) A friend's moment appears in get_friend_feed with kind 'moment' + photo_url.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.get_friend_feed(50)
          WHERE kind = 'moment' AND photo_url = 'https://cdn/moments/a/3.jpg'),
  'a friend''s moment appears in get_friend_feed with its photo_url');

RESET ROLE;

-- (9)+(10) content_reports CHECK accepts the new type and rejects a bogus one.
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason)
      VALUES ('e0420000-0000-4000-8000-000000000002', 'checkin_moment', '1', 'spam') $q$,
  'content_reports_content_type_check accepts checkin_moment');

SELECT extensions.throws_ok(
  $q$ INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason)
      VALUES ('e0420000-0000-4000-8000-000000000002', 'bogus_type_xyz', '1', 'spam') $q$,
  '23514', NULL, 'content_reports_content_type_check rejects an unknown type');

SELECT extensions.finish();
ROLLBACK;
