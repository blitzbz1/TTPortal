-- Migration: 133_equipment_reviews (F062)
-- Equipment database with community reviews: every blade/rubber in the
-- delta-synced catalog (024/046) becomes reviewable, but ONLY by players who
-- actually own it (have a saved equipment_history setup referencing it).
--
-- Design notes
-- ============
-- - A catalog model has NO surrogate id. It is the composite TEXT triple
--   (category, manufacturer_id, model) where category ∈ ('blade','rubber') —
--   the PK of equipment_catalog_models (024). equipment_reviews DENORMALIZES
--   that triple per row (no FK: catalog rows can be tombstoned/renamed via the
--   delta-sync, and a hard FK ON DELETE CASCADE would silently delete reviews).
-- - Public-readable like venue reviews: SELECT USING (true). Block visibility
--   is enforced CLIENT-SIDE against user_blocks (072 design note — never RLS).
-- - Writes go ONLY through post_equipment_review (SECURITY DEFINER). There is
--   NO direct INSERT policy: the owned-it gate (EXISTS over the owner-only-RLS
--   equipment_history) can't be checked client-side, so the DEFINER RPC is the
--   single write path. One review per user per model (UNIQUE upsert).
-- - The author's grip/style/hand are SNAPSHOTTED onto the review at write time
--   from their latest equipment_history. current_equipment_for_user (025) is
--   friend-gated, so it can't show arbitrary authors' profiles publicly — the
--   snapshot makes each author's real grip/style visible on the public model
--   page without leaking the full friend-gated setup.
-- - get_equipment_model_summary is SECURITY DEFINER because "N players use
--   this" counts DISTINCT owners over equipment_history (owner-only RLS) — the
--   client cannot do that cross-user count.
-- - Reuses the whole trust & safety stack the way 125 (checkin_moments) does:
--     * content_reports gains 'equipment_review' via a full DROP+ADD CHECK
--       reproducing the accumulated 8-value list from 125 and appending.
--     * ugc_suspicious() (098) soft-flags suspicious bodies on insert/update
--       (never blocks the write).
--     * rate_limit_config (047) seeds a post_equipment_review cap with a BEFORE
--       INSERT trigger (still fires on the DEFINER RPC's INSERT).
-- - F062 adds NO notification type — equipment reviews don't push.

-- 1. content_reports: allow reporting an equipment review ---------------------
-- DROP+ADD the FULL accumulated list from 125 (the eight values:
-- review, venue, checkin, photo, profile, venue_post, dm_message,
-- checkin_moment) and append 'equipment_review'. Never an in-place edit of a
-- frozen migration.
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN (
    'review', 'venue', 'checkin', 'photo', 'profile',
    'venue_post', 'dm_message', 'checkin_moment', 'equipment_review'
  ));

-- 2. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment_reviews (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL DEFAULT auth.uid()
                    REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Denormalized catalog-model identity (no surrogate id, no FK — see header).
  category        text NOT NULL CHECK (category IN ('blade', 'rubber')),
  manufacturer_id text NOT NULL,
  model           text NOT NULL,
  -- Ratings: overall 1..5 (mirror reviews.rating); the three axis bars 0..10.
  rating          int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  speed           int CHECK (speed BETWEEN 0 AND 10),
  spin            int CHECK (spin BETWEEN 0 AND 10),
  control         int CHECK (control BETWEEN 0 AND 10),
  time_used       text CHECK (time_used IS NULL OR time_used IN ('lt_1m', '1_6m', '6_12m', '1_2y', 'gt_2y')),
  body            text CHECK (body IS NULL OR char_length(body) <= 2000),
  -- Author profile snapshot (taken from latest equipment_history at write time).
  author_hand     text,
  author_style    text,
  author_grip     text,
  flagged         boolean NOT NULL DEFAULT false,
  flag_count      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- One review per user per model (editable in place — see the upsert RPC).
  UNIQUE (user_id, category, manufacturer_id, model)
);

-- Hot read path: all reviews for a given model, newest first.
CREATE INDEX IF NOT EXISTS idx_equipment_reviews_model
  ON public.equipment_reviews (category, manufacturer_id, model, created_at DESC);

-- 3. RLS: public read; NO direct insert (writes go through the DEFINER RPC) ---
ALTER TABLE public.equipment_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipment reviews are publicly readable" ON public.equipment_reviews;
CREATE POLICY "Equipment reviews are publicly readable"
  ON public.equipment_reviews
  FOR SELECT
  USING (true);
-- No INSERT/UPDATE/DELETE policies: the owned-it gate is enforced server-side
-- in post_equipment_review (SECURITY DEFINER), the only write path.

-- Public model page renders pre-auth too, so grant read to anon as well.
GRANT SELECT ON public.equipment_reviews TO authenticated, anon;

-- 4. Auto-flag suspicious bodies (098 / 125 pattern; soft flag, never blocks) -
CREATE OR REPLACE FUNCTION public.autoflag_suspicious_equipment_review()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.ugc_suspicious(NEW.body) THEN
    NEW.flagged := TRUE;
    NEW.flag_count := GREATEST(COALESCE(NEW.flag_count, 0), 1);
    PERFORM public.log_moderation_action('equipment_review_autoflagged', 'equipment_review',
      COALESCE(NEW.id::text, 'pending'),
      jsonb_build_object('category', NEW.category, 'manufacturer_id', NEW.manufacturer_id, 'model', NEW.model));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS autoflag_suspicious_equipment_review ON public.equipment_reviews;
CREATE TRIGGER autoflag_suspicious_equipment_review
  BEFORE INSERT OR UPDATE OF body ON public.equipment_reviews
  FOR EACH ROW EXECUTE FUNCTION public.autoflag_suspicious_equipment_review();

-- 5. Rate limit (047 / 125 pattern). Inserts flow through the DEFINER RPC, but
-- the BEFORE INSERT trigger still fires on the RPC's INSERT. --------------------
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('post_equipment_review', 'user',   600,  5, '5 equipment reviews per 10 minutes'),
  ('post_equipment_review', 'user', 86400, 30, '30 equipment reviews per 24 hours')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_post_equipment_review() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('post_equipment_review'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_post_equipment_review ON public.equipment_reviews;
CREATE TRIGGER rate_limit_post_equipment_review
  BEFORE INSERT ON public.equipment_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_post_equipment_review();

-- 6. Write RPC: post (or edit) a review — owners only -------------------------
-- (1) verify the caller OWNS the model (a saved equipment_history setup
--     references it in the blade / forehand / backhand slot);
-- (2) snapshot the author's grip/style/hand from their latest setup;
-- (3) UPSERT one review per user per model (re-posting EDITs in place).
CREATE OR REPLACE FUNCTION public.post_equipment_review(
  p_category        text,
  p_manufacturer_id text,
  p_model           text,
  p_rating          int,
  p_speed           int     DEFAULT NULL,
  p_spin            int     DEFAULT NULL,
  p_control         int     DEFAULT NULL,
  p_time_used       text    DEFAULT NULL,
  p_body            text    DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_id     bigint;
  v_hand   text;
  v_style  text;
  v_grip   text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_category NOT IN ('blade', 'rubber') THEN RAISE EXCEPTION 'invalid_category'; END IF;
  IF p_manufacturer_id IS NULL OR btrim(p_manufacturer_id) = ''
     OR p_model IS NULL OR btrim(p_model) = '' THEN
    RAISE EXCEPTION 'invalid_model';
  END IF;

  -- (1) Owned-it gate: the caller must have a saved setup that uses this model.
  IF NOT EXISTS (
    SELECT 1 FROM public.equipment_history eh
    WHERE eh.user_id = v_uid
      AND (
        (p_category = 'blade'
          AND eh.blade_manufacturer_id = p_manufacturer_id
          AND eh.blade_model = p_model)
        OR (p_category = 'rubber'
          AND (
            (eh.forehand_rubber_manufacturer_id = p_manufacturer_id AND eh.forehand_rubber_model = p_model)
            OR (eh.backhand_rubber_manufacturer_id = p_manufacturer_id AND eh.backhand_rubber_model = p_model)
          ))
      )
  ) THEN
    RAISE EXCEPTION 'not_owned';
  END IF;

  -- (2) Snapshot the author's grip/style/hand from their LATEST setup.
  SELECT eh.dominant_hand, eh.playing_style, eh.grip
    INTO v_hand, v_style, v_grip
  FROM public.equipment_history eh
  WHERE eh.user_id = v_uid
  ORDER BY eh.created_at DESC
  LIMIT 1;

  -- (3) Upsert: one review per user per model (re-post EDITs in place).
  INSERT INTO public.equipment_reviews (
    user_id, category, manufacturer_id, model,
    rating, speed, spin, control, time_used, body,
    author_hand, author_style, author_grip
  )
  VALUES (
    v_uid, p_category, p_manufacturer_id, p_model,
    p_rating, p_speed, p_spin, p_control, p_time_used,
    NULLIF(btrim(COALESCE(p_body, '')), ''),
    v_hand, v_style, v_grip
  )
  ON CONFLICT (user_id, category, manufacturer_id, model) DO UPDATE
    SET rating       = excluded.rating,
        speed        = excluded.speed,
        spin         = excluded.spin,
        control      = excluded.control,
        time_used    = excluded.time_used,
        body         = excluded.body,
        author_hand  = excluded.author_hand,
        author_style = excluded.author_style,
        author_grip  = excluded.author_grip,
        created_at   = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 7. Read RPC: aggregate model summary ---------------------------------------
-- DEFINER because "N players use this" counts DISTINCT owners over the
-- owner-only-RLS equipment_history. Averages are over equipment_reviews.
CREATE OR REPLACE FUNCTION public.get_equipment_model_summary(
  p_category        text,
  p_manufacturer_id text,
  p_model           text
)
RETURNS TABLE (
  review_count int,
  avg_rating   numeric,
  avg_speed    numeric,
  avg_spin     numeric,
  avg_control  numeric,
  users_count  int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT count(*)::int FROM public.equipment_reviews er
       WHERE er.category = p_category
         AND er.manufacturer_id = p_manufacturer_id
         AND er.model = p_model
         AND NOT er.flagged)                                            AS review_count,
    (SELECT round(avg(er.rating), 1) FROM public.equipment_reviews er
       WHERE er.category = p_category
         AND er.manufacturer_id = p_manufacturer_id
         AND er.model = p_model
         AND NOT er.flagged)                                            AS avg_rating,
    (SELECT round(avg(er.speed), 1) FROM public.equipment_reviews er
       WHERE er.category = p_category
         AND er.manufacturer_id = p_manufacturer_id
         AND er.model = p_model
         AND NOT er.flagged AND er.speed IS NOT NULL)                   AS avg_speed,
    (SELECT round(avg(er.spin), 1) FROM public.equipment_reviews er
       WHERE er.category = p_category
         AND er.manufacturer_id = p_manufacturer_id
         AND er.model = p_model
         AND NOT er.flagged AND er.spin IS NOT NULL)                    AS avg_spin,
    (SELECT round(avg(er.control), 1) FROM public.equipment_reviews er
       WHERE er.category = p_category
         AND er.manufacturer_id = p_manufacturer_id
         AND er.model = p_model
         AND NOT er.flagged AND er.control IS NOT NULL)                 AS avg_control,
    -- "N players use this": DISTINCT owners with a saved setup referencing the
    -- model in any of the blade / forehand / backhand slots.
    (SELECT count(DISTINCT eh.user_id)::int FROM public.equipment_history eh
       WHERE (p_category = 'blade'
                AND eh.blade_manufacturer_id = p_manufacturer_id
                AND eh.blade_model = p_model)
          OR (p_category = 'rubber'
                AND (
                  (eh.forehand_rubber_manufacturer_id = p_manufacturer_id AND eh.forehand_rubber_model = p_model)
                  OR (eh.backhand_rubber_manufacturer_id = p_manufacturer_id AND eh.backhand_rubber_model = p_model)
                )))                                                      AS users_count;
$$;

-- 8. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.post_equipment_review(text, text, text, int, int, int, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_equipment_review(text, text, text, int, int, int, int, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_equipment_model_summary(text, text, text) FROM PUBLIC;
-- The model page renders pre-auth too (matches the anon SELECT grant above).
GRANT EXECUTE ON FUNCTION public.get_equipment_model_summary(text, text, text) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
