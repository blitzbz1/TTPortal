-- F016 — venue board & Q&A (migration 112).
-- Verifies: posting, one-level-reply enforcement, block filtering, the
-- ugc_suspicious auto-flag hiding suspicious posts, and that content_reports
-- accepts the new 'venue_post' type.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(5);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('60000000-0000-4000-8000-0000000000a1', 'f016-a@example.com', '{"full_name":"Asker"}'::jsonb),
  ('60000000-0000-4000-8000-0000000000b2', 'f016-b@example.com', '{"full_name":"Blocked"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Boardton', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Board Venue', 'sala_indoor', 'Boardton',
        (SELECT id FROM public.cities WHERE name = 'Boardton'), 'St 1', 44.0, 26.0, true);

-- ── Asker (A) posts a question, then a reply is rejected on the reply ───────
SELECT set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-0000000000a1', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) Posting a top-level question inserts a row.
SELECT extensions.isnt(
  public.post_venue_message((SELECT id FROM public.venues WHERE name = 'Board Venue'), 'Open on Sundays?'),
  NULL,
  'post_venue_message inserts a question'
);

-- (2) One-level enforcement: replying to a reply throws.
DO $$
DECLARE v_q bigint; v_r bigint; v_venue int;
BEGIN
  v_venue := (SELECT id FROM public.venues WHERE name = 'Board Venue');
  v_q := public.post_venue_message(v_venue, 'Parent question');
  v_r := public.post_venue_message(v_venue, 'A reply', v_q);
  PERFORM set_config('test.reply_id', v_r::text, true);
END $$;

SELECT extensions.throws_ok(
  format($q$ SELECT public.post_venue_message(%s, 'reply to a reply', %s) $q$,
         (SELECT id FROM public.venues WHERE name = 'Board Venue'),
         current_setting('test.reply_id')),
  NULL, NULL,
  'replies are only one level deep'
);

-- (3) Auto-flag: a post containing a URL is flagged and hidden from the board.
SELECT public.post_venue_message((SELECT id FROM public.venues WHERE name = 'Board Venue'), 'visit http://spam.example for free bats');
SELECT extensions.ok(
  NOT (public.get_venue_board((SELECT id FROM public.venues WHERE name = 'Board Venue'))::text LIKE '%spam.example%'),
  'ugc_suspicious auto-flags a link post and the board hides it'
);

RESET ROLE;

-- ── Block filtering: B posts, A blocks B, A's board excludes B ──────────────
SELECT set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-0000000000b2', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT public.post_venue_message((SELECT id FROM public.venues WHERE name = 'Board Venue'), 'Question from blocked user');
RESET ROLE;

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('60000000-0000-4000-8000-0000000000a1', '60000000-0000-4000-8000-0000000000b2');

SELECT set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-0000000000a1', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (4) A's board view excludes the blocked user's post.
SELECT extensions.ok(
  NOT (public.get_venue_board((SELECT id FROM public.venues WHERE name = 'Board Venue'))::text LIKE '%blocked user%'),
  'get_venue_board excludes posts from blocked authors'
);

RESET ROLE;

-- (5) content_reports accepts the new 'venue_post' type.
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason)
      VALUES ('60000000-0000-4000-8000-0000000000a1', 'venue_post', '1', 'spam') $q$,
  'content_reports accepts a venue_post report'
);

SELECT extensions.finish();
ROLLBACK;
