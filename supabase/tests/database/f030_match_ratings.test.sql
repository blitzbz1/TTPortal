-- F030 — Elo match ratings (migration 119).
-- Verifies: a confirmed match moves both ratings by the provisional K=40 (equal
-- starting ratings → ±20), the per-match history is written once (idempotent),
-- peak tracks the high-water mark, and voiding a confirmed match recomputes
-- ratings back to baseline.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(6);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('9e000000-0000-4000-8000-000000000001', 'f030-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('9e000000-0000-4000-8000-000000000002', 'f030-b@example.com', '{"full_name":"Bob"}'::jsonb);

-- A logs a win over B (pending), then it's confirmed → fires apply_rating_on_confirm.
INSERT INTO public.matches (reporter_id, opponent_id, winner_id, status)
VALUES ('9e000000-0000-4000-8000-000000000001', '9e000000-0000-4000-8000-000000000002',
        '9e000000-0000-4000-8000-000000000001', 'pending');
UPDATE public.matches SET status = 'confirmed', confirmed_at = now()
 WHERE reporter_id = '9e000000-0000-4000-8000-000000000001' AND status = 'pending';

-- (1)/(2) equal 1200 starts, K=40 provisional → winner +20, loser -20.
SELECT extensions.is(
  (SELECT rating FROM public.player_ratings WHERE user_id = '9e000000-0000-4000-8000-000000000001'),
  1220, 'winner gains 20 (K=40 provisional, even matchup)');
SELECT extensions.is(
  (SELECT rating FROM public.player_ratings WHERE user_id = '9e000000-0000-4000-8000-000000000002'),
  1180, 'loser drops 20');

-- (3) one history row per player for the match.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.rating_history rh
   JOIN public.matches m ON m.id = rh.match_id
   WHERE m.reporter_id = '9e000000-0000-4000-8000-000000000001'),
  2, 'two rating_history rows (one per player)');

-- (4) idempotent: re-applying writes nothing new.
SELECT public.apply_match_rating(
  (SELECT id FROM public.matches WHERE reporter_id = '9e000000-0000-4000-8000-000000000001' LIMIT 1));
SELECT extensions.is(
  (SELECT count(*)::int FROM public.rating_history),
  2, 'apply_match_rating is idempotent');

-- (5) peak tracks the high-water mark.
SELECT extensions.is(
  (SELECT peak_rating FROM public.player_ratings WHERE user_id = '9e000000-0000-4000-8000-000000000001'),
  1220, 'peak_rating records the winner''s high');

-- (6) voiding the confirmed match recomputes back to baseline.
UPDATE public.matches SET status = 'void'
 WHERE reporter_id = '9e000000-0000-4000-8000-000000000001' AND status = 'confirmed';
SELECT extensions.is(
  (SELECT rating FROM public.player_ratings WHERE user_id = '9e000000-0000-4000-8000-000000000001')::text
    || ':' || (SELECT count(*)::int FROM public.rating_history)::text,
  '1200:0', 'voiding a confirmed match recomputes ratings to baseline');

SELECT extensions.finish();
ROLLBACK;
