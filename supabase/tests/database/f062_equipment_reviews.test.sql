-- F062 — Equipment database with community reviews (migration 133).
-- Verifies:
--   * a user who OWNS a model (a saved equipment_history setup references it)
--     can post_equipment_review (lives_ok); a NON-owner is rejected ('not_owned').
--   * one review per user per model: a re-post UPDATEs in place (count stays 1)
--     and edits the rating.
--   * the author's grip/style/hand are SNAPSHOTTED onto the review at write time.
--   * get_equipment_model_summary returns the correct avg rating and users_count
--     (COUNT DISTINCT owners across blade / forehand / backhand slots).
--   * content_reports CHECK accepts 'equipment_review' (lives_ok) and rejects a
--     bogus type (throws_ok 23514).
--   * the autoflag trigger soft-flags a spammy body (a URL).
--
-- The whole test is wrapped in BEGIN/ROLLBACK so nothing persists.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(12);

-- ── seed: three players (Ana owns the gear, Bob also owns the blade, Cara owns
--    nothing). The on_auth_user_created trigger auto-creates the profile rows. ──
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f0620000-0000-4000-8000-000000000001', 'f062-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('f0620000-0000-4000-8000-000000000002', 'f062-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('f0620000-0000-4000-8000-000000000003', 'f062-c@example.com', '{"full_name":"Cara"}'::jsonb);

-- Ana's saved setup: blade Butterfly Viscaria, forehand Tenergy 05,
-- backhand Dignics 09c. She is right-handed, attacker, shakehand.
INSERT INTO public.equipment_history (
  user_id,
  blade_manufacturer_id, blade_manufacturer, blade_model,
  forehand_rubber_manufacturer_id, forehand_rubber_manufacturer, forehand_rubber_model, forehand_rubber_color,
  backhand_rubber_manufacturer_id, backhand_rubber_manufacturer, backhand_rubber_model, backhand_rubber_color,
  dominant_hand, playing_style, grip
) VALUES (
  'f0620000-0000-4000-8000-000000000001',
  'butterfly', 'Butterfly', 'Viscaria',
  'butterfly', 'Butterfly', 'Tenergy 05', 'red',
  'butterfly', 'Butterfly', 'Dignics 09c', 'black',
  'right', 'attacker', 'shakehand'
);

-- Bob ALSO owns the Viscaria blade (different rubbers). Left-handed, defender,
-- penhold — so the model summary's owners_count for the blade is 2.
INSERT INTO public.equipment_history (
  user_id,
  blade_manufacturer_id, blade_manufacturer, blade_model,
  forehand_rubber_manufacturer_id, forehand_rubber_manufacturer, forehand_rubber_model, forehand_rubber_color,
  backhand_rubber_manufacturer_id, backhand_rubber_manufacturer, backhand_rubber_model, backhand_rubber_color,
  dominant_hand, playing_style, grip
) VALUES (
  'f0620000-0000-4000-8000-000000000002',
  'butterfly', 'Butterfly', 'Viscaria',
  'dhs', 'DHS', 'Hurricane 3', 'red',
  'butterfly', 'Butterfly', 'Rozena', 'black',
  'left', 'defender', 'penhold'
);

-- Cara has NO saved setup → she owns nothing.

-- ── act as Ana ───────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0620000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0620000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) Ana OWNS the Viscaria blade → she can post a review.
SELECT extensions.lives_ok(
  $q$ SELECT public.post_equipment_review('blade', 'butterfly', 'Viscaria', 5, 9, 7, 6, '1_2y', 'Great control') $q$,
  'an owner can post_equipment_review for a model they own');

-- (2) The author's grip/style/hand are snapshotted onto the review row.
SELECT extensions.is(
  (SELECT author_grip || '/' || author_style || '/' || author_hand
     FROM public.equipment_reviews
    WHERE user_id = 'f0620000-0000-4000-8000-000000000001'
      AND category = 'blade' AND manufacturer_id = 'butterfly' AND model = 'Viscaria'),
  'shakehand/attacker/right',
  'the author grip/style/hand are snapshotted from the latest equipment_history');

-- (3) Ana can also review a rubber she owns on the forehand side.
SELECT extensions.lives_ok(
  $q$ SELECT public.post_equipment_review('rubber', 'butterfly', 'Tenergy 05', 4, 8, 9, 5, '6_12m', NULL) $q$,
  'an owner can review a rubber mounted on the forehand side');

-- (4) Ana does NOT own the DHS Hurricane 3 rubber → 'not_owned'.
SELECT extensions.throws_ok(
  $q$ SELECT public.post_equipment_review('rubber', 'dhs', 'Hurricane 3', 5, 9, 9, 4, NULL, NULL) $q$,
  'not_owned',
  'reviewing a model you do not own raises not_owned');

-- (5) One review per user per model: re-posting EDITs in place (count stays 1).
SELECT public.post_equipment_review('blade', 'butterfly', 'Viscaria', 3, 6, 6, 8, 'gt_2y', 'Updated take');
SELECT extensions.is(
  (SELECT count(*)::int FROM public.equipment_reviews
     WHERE user_id = 'f0620000-0000-4000-8000-000000000001'
       AND category = 'blade' AND manufacturer_id = 'butterfly' AND model = 'Viscaria'),
  1, 'a re-post UPDATEs the existing review (one review per user per model)');

SELECT extensions.is(
  (SELECT rating FROM public.equipment_reviews
     WHERE user_id = 'f0620000-0000-4000-8000-000000000001'
       AND category = 'blade' AND manufacturer_id = 'butterfly' AND model = 'Viscaria'),
  3, 'the re-post edits the rating in place');

RESET ROLE;

-- ── act as Bob (also owns the Viscaria blade) ────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0620000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0620000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (6) Bob reviews the Viscaria he owns (rating 5) so the model now has 2 reviews.
SELECT extensions.lives_ok(
  $q$ SELECT public.post_equipment_review('blade', 'butterfly', 'Viscaria', 5, 8, 8, 7, '1_6m', NULL) $q$,
  'a second owner can review the same model');

RESET ROLE;

-- ── act as Cara (owns nothing) ───────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0620000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0620000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (7) Cara has no saved setup → she cannot review anything.
SELECT extensions.throws_ok(
  $q$ SELECT public.post_equipment_review('blade', 'butterfly', 'Viscaria', 5, 9, 9, 9, NULL, NULL) $q$,
  'not_owned',
  'a non-owner (no saved setup) is rejected with not_owned');

-- (8) get_equipment_model_summary for the Viscaria blade: 2 reviews (Ana edited
--     to 3, Bob 5 → avg 4.0) and users_count = 2 (Ana + Bob own the blade).
SELECT extensions.is(
  (SELECT review_count || '/' || avg_rating || '/' || users_count
     FROM public.get_equipment_model_summary('blade', 'butterfly', 'Viscaria')),
  '2/4.0/2',
  'get_equipment_model_summary returns review_count, avg_rating and DISTINCT owners_count');

RESET ROLE;

-- (9)+(10) content_reports CHECK accepts the new type and rejects a bogus one.
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason)
      VALUES ('f0620000-0000-4000-8000-000000000003', 'equipment_review', '1', 'spam') $q$,
  'content_reports_content_type_check accepts equipment_review');

SELECT extensions.throws_ok(
  $q$ INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason)
      VALUES ('f0620000-0000-4000-8000-000000000003', 'bogus_type_xyz', '1', 'spam') $q$,
  '23514', NULL, 'content_reports_content_type_check rejects an unknown type');

-- (11) The autoflag trigger soft-flags a body containing a URL (Ana, as owner).
SELECT set_config('request.jwt.claim.sub', 'f0620000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0620000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT public.post_equipment_review('rubber', 'butterfly', 'Tenergy 05', 4, 8, 9, 5, NULL, 'Buy cheap at http://spam.example.com now');
SELECT extensions.ok(
  (SELECT flagged FROM public.equipment_reviews
     WHERE user_id = 'f0620000-0000-4000-8000-000000000001'
       AND category = 'rubber' AND manufacturer_id = 'butterfly' AND model = 'Tenergy 05'),
  'the autoflag trigger soft-flags a review body containing a URL');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
