-- Current equipment visibility and durable badge award records.

CREATE OR REPLACE VIEW public.current_equipment AS
SELECT DISTINCT ON (user_id)
  id,
  user_id,
  blade_manufacturer_id,
  blade_manufacturer,
  blade_model,
  forehand_rubber_manufacturer_id,
  forehand_rubber_manufacturer,
  forehand_rubber_model,
  forehand_rubber_color,
  backhand_rubber_manufacturer_id,
  backhand_rubber_manufacturer,
  backhand_rubber_model,
  backhand_rubber_color,
  dominant_hand,
  playing_style,
  grip,
  created_at
FROM public.equipment_history
ORDER BY user_id, created_at DESC, id DESC;

CREATE OR REPLACE FUNCTION public.current_equipment_for_user(v_user_id uuid)
RETURNS SETOF public.current_equipment
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ce.*
  FROM public.current_equipment ce
  WHERE ce.user_id = v_user_id
    AND (
      auth.uid() = v_user_id
      OR EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = auth.uid() AND f.addressee_id = v_user_id)
            OR (f.requester_id = v_user_id AND f.addressee_id = auth.uid())
          )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_equipment_for_user(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.badge_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category public.challenge_category NOT NULL,
  tier public.badge_level NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  completed_count integer NOT NULL CHECK (completed_count IN (5, 10, 15)),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  source_submission_id uuid REFERENCES public.challenge_submissions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT badge_awards_unique_user_category_tier UNIQUE (user_id, category, tier)
);

CREATE INDEX IF NOT EXISTS badge_awards_user_awarded_idx
  ON public.badge_awards(user_id, awarded_at DESC);

ALTER TABLE public.badge_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own badge awards" ON public.badge_awards;
CREATE POLICY "users read own badge awards"
ON public.badge_awards
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_badge_progress_from_submission(v_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_category public.challenge_category;
  v_completed_at timestamptz;
  v_total integer;
  v_level public.badge_level;
BEGIN
  SELECT s.user_id, c.category, COALESCE(s.reviewed_at, s.submitted_at)
  INTO v_user_id, v_category, v_completed_at
  FROM public.challenge_submissions s
  JOIN public.challenges c ON c.id = s.challenge_id
  WHERE s.id = v_submission_id
    AND s.status IN ('approved', 'auto_approved');

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_total
  FROM public.challenge_submissions s
  JOIN public.challenges c ON c.id = s.challenge_id
  WHERE s.user_id = v_user_id
    AND c.category = v_category
    AND s.status IN ('approved', 'auto_approved');

  v_level := public.recompute_badge_level(v_total);

  INSERT INTO public.user_badge_progress (
    user_id, category, completed_count, approved_count, xp, badge_level, last_completed_at
  )
  VALUES (
    v_user_id, v_category, v_total, v_total, v_total * 100, v_level, v_completed_at
  )
  ON CONFLICT (user_id, category)
  DO UPDATE SET
    completed_count = EXCLUDED.completed_count,
    approved_count = EXCLUDED.approved_count,
    xp = EXCLUDED.xp,
    badge_level = EXCLUDED.badge_level,
    last_completed_at = GREATEST(public.user_badge_progress.last_completed_at, EXCLUDED.last_completed_at),
    updated_at = now();

  IF v_total >= 5 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at, source_submission_id)
    VALUES (v_user_id, v_category, 'bronze', 5, v_completed_at, v_submission_id)
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;

  IF v_total >= 10 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at, source_submission_id)
    VALUES (v_user_id, v_category, 'silver', 10, v_completed_at, v_submission_id)
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;

  IF v_total >= 15 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at, source_submission_id)
    VALUES (v_user_id, v_category, 'gold', 15, v_completed_at, v_submission_id)
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;
END;
$$;

WITH ranked AS (
  SELECT
    s.id AS submission_id,
    s.user_id,
    c.category,
    COALESCE(s.reviewed_at, s.submitted_at) AS awarded_at,
    ROW_NUMBER() OVER (
      PARTITION BY s.user_id, c.category
      ORDER BY COALESCE(s.reviewed_at, s.submitted_at), s.submitted_at, s.id
    ) AS rn
  FROM public.challenge_submissions s
  JOIN public.challenges c ON c.id = s.challenge_id
  WHERE s.status IN ('approved', 'auto_approved')
)
INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at, source_submission_id)
SELECT
  user_id,
  category,
  CASE rn
    WHEN 5 THEN 'bronze'::public.badge_level
    WHEN 10 THEN 'silver'::public.badge_level
    WHEN 15 THEN 'gold'::public.badge_level
  END,
  rn,
  awarded_at,
  submission_id
FROM ranked
WHERE rn IN (5, 10, 15)
ON CONFLICT (user_id, category, tier) DO NOTHING;

COMMENT ON FUNCTION public.current_equipment_for_user(uuid) IS
  'Returns the latest saved equipment setup for the requested user when called by that user or an accepted friend.';

COMMENT ON TABLE public.badge_awards IS
  'Durable badge award records used for earned dates, notifications, sharing, animation, and anti-cheat review.';
