-- Migration: 086_review_vote_constraints
-- One review / one condition vote per user per venue, plus rate limits.
--
-- Neither reviews nor condition_votes had a UNIQUE(user_id, venue_id)
-- constraint or a rate-limit trigger (047 covers only venues/events/
-- checkins) — one user could insert thousands of reviews for a venue,
-- skewing venue_stats.avg_rating, the reviews leaderboard, and the
-- crowd-sourced condition color.
--
-- Client lands alongside: createReview/submitVote switch to upsert
-- (edit-in-place).

-- ----------------------------------------------------------------------
-- Dedupe existing data (keep the newest row per user/venue)
-- ----------------------------------------------------------------------

DELETE FROM public.reviews r
USING public.reviews newer
WHERE r.user_id IS NOT NULL
  AND newer.user_id = r.user_id
  AND newer.venue_id = r.venue_id
  AND (newer.created_at > r.created_at
       OR (newer.created_at = r.created_at AND newer.id > r.id));

DELETE FROM public.condition_votes v
USING public.condition_votes newer
WHERE newer.user_id = v.user_id
  AND newer.venue_id = v.venue_id
  AND (newer.created_at > v.created_at
       OR (newer.created_at = v.created_at AND newer.id > v.id));

-- ----------------------------------------------------------------------
-- Uniqueness
-- ----------------------------------------------------------------------

-- reviews.user_id is nullable (ON DELETE SET NULL): NULLs are distinct, so
-- deleted-author reviews never conflict with each other.
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_user_venue_unique;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_user_venue_unique UNIQUE (user_id, venue_id);

ALTER TABLE public.condition_votes
  DROP CONSTRAINT IF EXISTS condition_votes_user_venue_unique;
ALTER TABLE public.condition_votes
  ADD CONSTRAINT condition_votes_user_venue_unique UNIQUE (user_id, venue_id);

-- Upsert needs an own-row UPDATE policy on condition_votes (004 only had
-- SELECT + INSERT). Reviews already have "Users can update own reviews".
DROP POLICY IF EXISTS "Users can update own condition votes" ON public.condition_votes;
CREATE POLICY "Users can update own condition votes" ON public.condition_votes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------
-- Rate limits (mirrors 047's trigger pattern)
-- ----------------------------------------------------------------------

INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('add_review',     'user',   600, 10, '10 review writes per 10 minutes'),
  ('add_review',     'user', 86400, 50, '50 review writes per 24 hours'),
  ('condition_vote', 'user',   600, 10, '10 condition votes per 10 minutes'),
  ('condition_vote', 'user', 86400, 50, '50 condition votes per 24 hours')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_add_review() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('add_review'); RETURN new; END $$;

CREATE OR REPLACE FUNCTION public.trg_enforce_condition_vote() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('condition_vote'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_add_review ON public.reviews;
CREATE TRIGGER rate_limit_add_review
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_add_review();

DROP TRIGGER IF EXISTS rate_limit_condition_vote ON public.condition_votes;
CREATE TRIGGER rate_limit_condition_vote
  BEFORE INSERT ON public.condition_votes
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_condition_vote();

NOTIFY pgrst, 'reload schema';
