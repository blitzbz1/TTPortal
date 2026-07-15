-- Migration: 124_referrals (F041)
-- Referral links with auto-friend on join. Every profile gets a shareable
-- 6-char referral_code; claiming a code via /join/<code> auto-creates an
-- ACCEPTED friendship both ways, awards the inviter a Recruiter badge at
-- 1/5/10 invites, and pushes the inviter a 'referral_joined' notification.
--
-- Design notes
-- ============
-- - referral_code mirrors 123's generate_club_join_code (035 collision-retry
--   idiom, base-less, uppercase alnum). It is assigned at signup inside
--   handle_new_user() (035, frozen — reproduced here in full, not edited
--   there) and backfilled for existing rows by a ROW-BY-ROW loop. A bulk
--   `UPDATE ... SET referral_code = generate_referral_code()` would evaluate
--   the generator's collision SELECT against one MVCC snapshot and could hand
--   the same code to several rows in the batch; a per-row loop makes each new
--   code visible to the next iteration.
-- - claim_referral MUST be SECURITY DEFINER: the friendships INSERT RLS policy
--   (004) requires auth.uid() = requester_id, so a normal-privilege caller
--   (the referee) could never insert the referrer-as-requester accepted row.
--   The DEFINER context also reads the referrer's profile by code regardless
--   of the caller. Guards: self-referral, double-claim (UNIQUE referee_id),
--   and a pre-existing friendship in EITHER direction.
-- - Recruiter badge reuses the 025 badge_awards display. badge_awards.category
--   is the challenge_category ENUM and completed_count CHECKs counts at
--   (5,10,15); a 1/5/10 Recruiter badge needs the enum value 'recruiter' added
--   and the completed_count CHECK relaxed to also allow 1. 025 is frozen — the
--   enum value and the CHECK are extended here, never edited there.
-- - notifications.type CHECK + notification_category() are reproduced in FULL
--   from 123 (post-freeze cumulative reproduction rule) and extended with
--   'referral_joined' → category 'referrals' (a new toggleable category).
-- - referral_code gets an anon SELECT grant so a pre-auth /join web page can
--   resolve a code; no other private profile columns are widened.

-- 1. profiles.referral_code (104/085 column-grant + 035 generation) ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- 085-style per-column grants (prior table grants don't cover new columns).
-- anon too: the /join page may resolve a code before the user authenticates.
GRANT SELECT (referral_code) ON public.profiles TO authenticated;
GRANT SELECT (referral_code) ON public.profiles TO anon;

-- 2. Referral-code generation (035/123 collision-retry, base-less) -----------
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  candidate TEXT;
  -- Uppercase alphanumeric; ambiguous chars are fine (codes are shared as
  -- text via a link, not transcribed by hand from a distance).
  alphabet TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * 36)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = candidate);
    attempts := attempts + 1;
    IF attempts > 25 THEN
      -- Astronomically unlikely; widen to 7 chars to guarantee progress.
      candidate := candidate || substr(alphabet, 1 + floor(random() * 36)::int, 1);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = candidate);
      attempts := 0;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Assign referral_code at signup (035 handle_new_user reproduced in full) --
-- 035 is frozen; its body is reproduced verbatim here with referral_code added
-- to the INSERT and the 089 search_path hardening applied.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  resolved_name TEXT;
BEGIN
  resolved_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    ''
  );
  INSERT INTO public.profiles (id, full_name, email, auth_provider, username, referral_code)
  VALUES (
    NEW.id,
    resolved_name,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'auth_provider', 'email'),
    public.generate_username(resolved_name),
    public.generate_referral_code()
  );
  RETURN NEW;
END;
$$;

-- 4. Backfill existing rows (ROW-BY-ROW — see Design notes) ------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles
    SET referral_code = public.generate_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;

-- 5. referrals table + RLS (SELECT-only; writes via claim_referral) ----------
CREATE TABLE IF NOT EXISTS public.referrals (
  id          bigserial PRIMARY KEY,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id  uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referrals readable by either party" ON public.referrals;
CREATE POLICY "Referrals readable by either party" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());
GRANT SELECT ON public.referrals TO authenticated;

-- 6. Recruiter badge: extend 025's challenge_category + completed_count CHECK -
-- 094 defines challenge_category (8 values); 025 defines badge_awards. Both are
-- frozen — extended here. A freshly ADDed enum value cannot be used as a
-- literal in the same transaction, so the 'recruiter' awards below are written
-- by claim_referral in a SEPARATE later transaction (never in this migration).
ALTER TYPE public.challenge_category ADD VALUE IF NOT EXISTS 'recruiter';

-- Relax the completed_count CHECK to also permit a 1 (Recruiter bronze). The
-- inline CHECK from 025 is auto-named badge_awards_completed_count_check.
ALTER TABLE public.badge_awards DROP CONSTRAINT IF EXISTS badge_awards_completed_count_check;
ALTER TABLE public.badge_awards
  ADD CONSTRAINT badge_awards_completed_count_check CHECK (completed_count IN (1, 5, 10, 15));

-- 7. Notification category + type allowlist (reproduce full bodies from 123) -
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'event_feedback_request', 'event_feedback_received',
    'checkin_nearby', 'review_on_venue', 'feedback_reply',
    'match_confirm', 'match_confirmed', 'match_disputed',
    'venue_post_reply',
    'play_broadcast', 'play_join', 'play_converted',
    'match_invite', 'match_invite_accepted',
    'dm_message',
    'bracket_match_ready',
    'season_ended',
    'club_event_created',   -- F040
    'referral_joined'       -- F041
  ));

CREATE OR REPLACE FUNCTION public.notification_category(p_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type IN ('friend_request', 'friend_accepted') THEN 'friend_requests'
    WHEN p_type IN ('checkin', 'checkin_nearby', 'friend_checkin') THEN 'friend_checkins'
    WHEN p_type IN ('event_reminder', 'event_update', 'event_cancelled', 'event_joined',
                    'event_invite', 'event_challenge',
                    'event_feedback_request', 'event_feedback_received') THEN 'events'
    WHEN p_type IN ('review', 'review_on_venue') THEN 'reviews_on_my_venue'
    WHEN p_type IN ('feedback_reply') THEN 'feedback_replies'
    WHEN p_type IN ('match_confirm', 'match_confirmed', 'match_disputed') THEN 'matches'
    WHEN p_type IN ('venue_post_reply') THEN 'venue_board'
    WHEN p_type IN ('play_broadcast', 'play_join', 'play_converted') THEN 'open_play'
    WHEN p_type IN ('match_invite', 'match_invite_accepted') THEN 'match_invites'
    WHEN p_type IN ('dm_message') THEN 'messages'
    WHEN p_type IN ('bracket_match_ready') THEN 'tournaments'
    WHEN p_type IN ('season_ended') THEN 'seasons'
    WHEN p_type IN ('club_event_created') THEN 'club_event'
    WHEN p_type IN ('referral_joined') THEN 'referrals'
    ELSE NULL
  END;
$$;

-- 8. Rate limits (047 pattern). claim cap is generous; the 5/day "invites" cap
--    in the F041 source applies to the email invite path, not code claims. -----
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('claim_referral', 'user', 86400, 20, '20 referral claims per day')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_claim_referral() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('claim_referral'); RETURN new; END $$;
DROP TRIGGER IF EXISTS rate_limit_claim_referral ON public.referrals;
CREATE TRIGGER rate_limit_claim_referral
  BEFORE INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_claim_referral();

-- 9. Write RPC: claim a referral by code ------------------------------------
-- Resolves the referrer by code, inserts the referral + an ACCEPTED friendship
-- (both directions visible because the row is requester=referrer), awards the
-- Recruiter badge at 1/5/10, and pushes the referrer. Returns the referrer id.
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_total int;
  v_referrer_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_code IS NULL OR btrim(p_code) = '' THEN RAISE EXCEPTION 'empty referral code'; END IF;

  SELECT id INTO v_referrer
  FROM public.profiles
  WHERE referral_code = upper(btrim(p_code));
  IF v_referrer IS NULL THEN RAISE EXCEPTION 'referrer_not_found'; END IF;

  IF v_referrer = v_uid THEN RAISE EXCEPTION 'self_referral'; END IF;

  -- Double-claim guard: a user can be referred only once.
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = v_uid) THEN
    RAISE EXCEPTION 'already_referred';
  END IF;

  -- Already-friends guard (either direction): if a friendship row already
  -- exists we still record the referral but skip the friendship insert.
  INSERT INTO public.referrals (referrer_id, referee_id) VALUES (v_referrer, v_uid);

  -- Ensure exactly ONE accepted friendship for the pair. friendships' UNIQUE is
  -- one-directional, so (referrer,referee) and (referee,referrer) are distinct
  -- rows; a blind insert when the referee had already friend-requested the
  -- referrer would leave TWO accepted rows (a duplicate friend). So: if any row
  -- exists in either direction, promote it to accepted; otherwise insert one.
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (requester_id = v_referrer AND addressee_id = v_uid)
       OR (requester_id = v_uid AND addressee_id = v_referrer)
  ) THEN
    UPDATE public.friendships
    SET status = 'accepted'
    WHERE ((requester_id = v_referrer AND addressee_id = v_uid)
        OR (requester_id = v_uid AND addressee_id = v_referrer))
      AND status <> 'accepted';
  ELSE
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (v_referrer, v_uid, 'accepted');
  END IF;

  -- Recruiter badge at 1/5/10 (025 idiom; ON CONFLICT keeps it idempotent).
  SELECT count(*)::int INTO v_total FROM public.referrals WHERE referrer_id = v_referrer;
  IF v_total >= 1 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at)
    VALUES (v_referrer, 'recruiter', 'bronze', 1, now())
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;
  IF v_total >= 5 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at)
    VALUES (v_referrer, 'recruiter', 'silver', 5, now())
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;
  IF v_total >= 10 THEN
    INSERT INTO public.badge_awards (user_id, category, tier, completed_count, awarded_at)
    VALUES (v_referrer, 'recruiter', 'gold', 10, now())
    ON CONFLICT (user_id, category, tier) DO NOTHING;
  END IF;

  -- Push the referrer (097 choke point; self-notify auto-skipped, but referrer
  -- and referee differ here by construction).
  SELECT full_name INTO v_referrer_name FROM public.profiles WHERE id = v_uid;
  PERFORM public.create_and_send_notification(
    v_referrer, v_uid, 'referral_joined',
    'Ai un prieten nou pe TTPortal',
    COALESCE(NULLIF(btrim(v_referrer_name), ''), 'Cineva') || ' s-a alăturat prin invitația ta.',
    jsonb_build_object('screen', '/(protected)/friends')
  );

  RETURN v_referrer;
END;
$$;

-- 10. Read RPC: the caller's referral_code + how many they've invited --------
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS TABLE (referral_code text, invited_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    p.referral_code,
    (SELECT count(*)::int FROM public.referrals r WHERE r.referrer_id = auth.uid())
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- 11. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_referral_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
