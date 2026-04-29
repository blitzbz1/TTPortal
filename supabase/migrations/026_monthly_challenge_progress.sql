-- Reset active badge-track progress every calendar month while preserving durable badge awards.

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
  v_month_start timestamptz;
  v_next_month_start timestamptz;
  v_month_total integer;
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

  v_month_start := date_trunc('month', v_completed_at);
  v_next_month_start := v_month_start + interval '1 month';

  SELECT COUNT(*)::integer
  INTO v_month_total
  FROM public.challenge_submissions s
  JOIN public.challenges c ON c.id = s.challenge_id
  WHERE s.user_id = v_user_id
    AND c.category = v_category
    AND s.status IN ('approved', 'auto_approved')
    AND COALESCE(s.reviewed_at, s.submitted_at) >= v_month_start
    AND COALESCE(s.reviewed_at, s.submitted_at) < v_next_month_start;

  v_level := public.recompute_badge_level(v_month_total);

  INSERT INTO public.user_badge_progress (
    user_id, category, completed_count, approved_count, xp, badge_level, last_completed_at
  )
  VALUES (
    v_user_id, v_category, v_month_total, v_month_total, v_month_total * 100, v_level, v_completed_at
  )
  ON CONFLICT (user_id, category)
  DO UPDATE SET
    completed_count = EXCLUDED.completed_count,
    approved_count = EXCLUDED.approved_count,
    xp = EXCLUDED.xp,
    badge_level = EXCLUDED.badge_level,
    last_completed_at = EXCLUDED.last_completed_at,
    updated_at = now();

  IF v_month_total >= 5 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at, source_submission_id)
    VALUES (v_user_id, v_category, 'bronze'::public.badge_level, 5, v_completed_at, v_submission_id)
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;

  IF v_month_total >= 10 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at, source_submission_id)
    VALUES (v_user_id, v_category, 'silver'::public.badge_level, 10, v_completed_at, v_submission_id)
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;

  IF v_month_total >= 15 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at, source_submission_id)
    VALUES (v_user_id, v_category, 'gold'::public.badge_level, 15, v_completed_at, v_submission_id)
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;
END;
$$;

WITH pairs AS (
  SELECT user_id, category
  FROM public.user_badge_progress
  UNION
  SELECT s.user_id, c.category
  FROM public.challenge_submissions s
  JOIN public.challenges c ON c.id = s.challenge_id
  WHERE s.status IN ('approved', 'auto_approved')
),
month_window AS (
  SELECT
    date_trunc('month', now()) AS month_start,
    date_trunc('month', now()) + interval '1 month' AS next_month_start
),
monthly AS (
  SELECT
    s.user_id,
    c.category,
    COUNT(*)::integer AS completed_count,
    MAX(COALESCE(s.reviewed_at, s.submitted_at)) AS last_completed_at
  FROM public.challenge_submissions s
  JOIN public.challenges c ON c.id = s.challenge_id
  CROSS JOIN month_window mw
  WHERE s.status IN ('approved', 'auto_approved')
    AND COALESCE(s.reviewed_at, s.submitted_at) >= mw.month_start
    AND COALESCE(s.reviewed_at, s.submitted_at) < mw.next_month_start
  GROUP BY s.user_id, c.category
)
INSERT INTO public.user_badge_progress (
  user_id,
  category,
  completed_count,
  approved_count,
  xp,
  badge_level,
  last_completed_at
)
SELECT
  p.user_id,
  p.category,
  COALESCE(m.completed_count, 0),
  COALESCE(m.completed_count, 0),
  COALESCE(m.completed_count, 0) * 100,
  public.recompute_badge_level(COALESCE(m.completed_count, 0)),
  m.last_completed_at
FROM pairs p
LEFT JOIN monthly m
  ON m.user_id = p.user_id
 AND m.category = p.category
ON CONFLICT (user_id, category)
DO UPDATE SET
  completed_count = EXCLUDED.completed_count,
  approved_count = EXCLUDED.approved_count,
  xp = EXCLUDED.xp,
  badge_level = EXCLUDED.badge_level,
  last_completed_at = EXCLUDED.last_completed_at,
  updated_at = now();

COMMENT ON FUNCTION public.sync_badge_progress_from_submission(uuid) IS
  'Maintains current-month challenge progress for each badge track and records durable badge awards at 5, 10, and 15 monthly completions.';
