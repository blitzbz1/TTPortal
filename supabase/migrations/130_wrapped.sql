-- Migration: 130_wrapped (F054)
-- "TT Wrapped" — a year-in-review story aggregated PURELY over existing tables
-- (no core new tables) plus a mid-December "unlock" teaser pg_cron that nudges
-- ONLY users who actually played this year (no guilt spam, mirroring 128/021).
--
-- Design notes
-- ============
-- - year_in_review(p_user_id, p_year) is a SECURITY DEFINER STABLE RPC returning
--   a single nested JSONB object (cleaner than a flat TABLE for a multi-card
--   story). It aggregates the calendar year
--     [makedate(p_year, 1, 1), makedate(p_year + 1, 1, 1)):
--     * hours          = SUM of checkin durations (ended_at - started_at) for
--                        in-window checkins PLUS SUM of
--                        event_participants.hours_played for events whose
--                        starts_at falls in the window (BOTH sources, like
--                        get_profile_stats / get_weekly_recap / PlayHistory).
--     * sessions       = count of in-window checkins.
--     * venues         = count(DISTINCT venue_id) of in-window checkins.
--     * events         = count of event_participants whose event starts_at is in
--                        the window.
--     * top_venue      = the venue with the MOST of the user's in-window
--                        checkins → { id, name, checkins } (NULL if none).
--     * top_month      = the calendar month (1-12) with the most sessions →
--                        { month, sessions } (NULL if none).
--     * partner_of_year= the most-frequent co-player across the year, taken from
--                        BOTH checkins.friends[] (tagged co-players) AND match
--                        opponents in public.matches → { user_id, full_name }
--                        (NULL if none).
--     * badges         = count of badge_awards earned in the window
--                        (awarded_at in range).
--     * milestones     = count of user_milestones (F053) achieved in the window
--                        (achieved_at in range).
--     * archetype      = a RULE-BASED string KEY derived from the stats; the
--                        client localizes it. Rules are simple + deterministic
--                        (see below). Default 'casual'.
-- - The Dec-unlock teaser (send_wrapped_teasers) self-guards on the date: it only
--   acts on/after Dec 15. It selects users with >=1 checkin in the CURRENT year
--   and enqueues ONE 'year_wrapped' notification through
--   create_and_send_notification (097 choke point — so the new 'wrapped' category
--   opt-out is honored), NOT EXISTS de-duped per (year) period, each wrapped in
--   BEGIN/EXCEPTION WHEN OTHERS THEN NULL so one failure can't abort the run.
-- - notifications_type_check + notification_category() are reproduced IN FULL
--   from 128 (the post-freeze cumulative reproduction rule; 129 added no type)
--   and extended with 'year_wrapped' -> category 'wrapped'.
-- - No new CORE tables (per the task): everything reads existing checkins /
--   event_participants / events / venues / matches / profiles / badge_awards /
--   user_milestones.

-- 1. The year-in-review aggregation RPC --------------------------------------
-- Brand new function, so no DROP needed (no prior overload to clash with).
CREATE OR REPLACE FUNCTION public.year_in_review(
  p_user_id uuid,
  p_year    int DEFAULT extract(year FROM now())::int
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start          timestamptz := make_date(p_year, 1, 1)::timestamptz;
  v_end            timestamptz := make_date(p_year + 1, 1, 1)::timestamptz;
  v_hours          numeric := 0;
  v_sessions       int := 0;
  v_venues         int := 0;
  v_events         int := 0;
  v_badges         int := 0;
  v_milestones     int := 0;
  v_outdoor        int := 0;   -- in-window checkins at outdoor venues
  v_partners       int := 0;   -- distinct co-players over the year
  v_top_venue      jsonb := NULL;
  v_top_month      jsonb := NULL;
  v_partner        jsonb := NULL;
  v_archetype      text := 'casual';
BEGIN
  -- Core checkin aggregates: sessions, distinct venues, summed duration, and how
  -- many in-window checkins were at OUTDOOR venues (drives the archetype rule).
  SELECT
    count(*)::int,
    count(DISTINCT c.venue_id)::int,
    coalesce(sum(extract(epoch FROM (c.ended_at - c.started_at)) / 3600.0), 0),
    (count(*) FILTER (WHERE v.type = 'parc_exterior'))::int
  INTO v_sessions, v_venues, v_hours, v_outdoor
  FROM public.checkins c
  JOIN public.venues v ON v.id = c.venue_id
  WHERE c.user_id = p_user_id
    AND c.started_at >= v_start AND c.started_at < v_end;

  -- Event hours + event count (events the user joined that started in the year).
  -- Combine BOTH hour sources (checkin durations + event hours) like
  -- get_profile_stats / get_weekly_recap / PlayHistoryScreen.
  SELECT
    v_hours + coalesce(sum(ep.hours_played), 0),
    count(*)::int
  INTO v_hours, v_events
  FROM public.event_participants ep
  JOIN public.events e ON e.id = ep.event_id
  WHERE ep.user_id = p_user_id
    AND e.starts_at >= v_start AND e.starts_at < v_end;

  v_hours := round(v_hours::numeric, 1);

  -- Badges earned in the year (durable badge_awards rows).
  SELECT count(*)::int INTO v_badges
  FROM public.badge_awards ba
  WHERE ba.user_id = p_user_id
    AND ba.awarded_at >= v_start AND ba.awarded_at < v_end;

  -- Milestones achieved in the year (F053 user_milestones).
  SELECT count(*)::int INTO v_milestones
  FROM public.user_milestones um
  WHERE um.user_id = p_user_id
    AND um.achieved_at >= v_start AND um.achieved_at < v_end;

  -- Top venue: the venue with the most in-window checkins.
  SELECT jsonb_build_object('id', t.venue_id, 'name', t.name, 'checkins', t.cnt)
  INTO v_top_venue
  FROM (
    SELECT c.venue_id, v.name, count(*)::int AS cnt
    FROM public.checkins c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.user_id = p_user_id
      AND c.started_at >= v_start AND c.started_at < v_end
    GROUP BY c.venue_id, v.name
    ORDER BY cnt DESC, c.venue_id
    LIMIT 1
  ) t;

  -- Top month: the calendar month (1-12) with the most sessions.
  SELECT jsonb_build_object('month', t.mon, 'sessions', t.cnt)
  INTO v_top_month
  FROM (
    SELECT extract(month FROM c.started_at)::int AS mon, count(*)::int AS cnt
    FROM public.checkins c
    WHERE c.user_id = p_user_id
      AND c.started_at >= v_start AND c.started_at < v_end
    GROUP BY mon
    ORDER BY cnt DESC, mon
    LIMIT 1
  ) t;

  -- Partner of the year: the most-frequent co-player across BOTH tagged
  -- checkins.friends[] AND confirmed/any match opponents. count over the union,
  -- pick the top, join profiles for the name.
  WITH co AS (
    -- Tagged co-players on the user's in-window checkins.
    SELECT f.partner_id AS partner_id
    FROM public.checkins c
    CROSS JOIN LATERAL unnest(c.friends) AS f(partner_id)
    WHERE c.user_id = p_user_id
      AND c.started_at >= v_start AND c.started_at < v_end
      AND f.partner_id IS NOT NULL
      AND f.partner_id <> p_user_id
    UNION ALL
    -- Match opponents (the user can be reporter OR opponent).
    SELECT CASE WHEN m.reporter_id = p_user_id THEN m.opponent_id
                ELSE m.reporter_id END AS partner_id
    FROM public.matches m
    WHERE (m.reporter_id = p_user_id OR m.opponent_id = p_user_id)
      AND m.created_at >= v_start AND m.created_at < v_end
  ),
  ranked AS (
    SELECT partner_id, count(*)::int AS cnt
    FROM co
    WHERE partner_id IS NOT NULL
    GROUP BY partner_id
    ORDER BY cnt DESC, partner_id
    LIMIT 1
  )
  SELECT
    count(DISTINCT co.partner_id)::int,
    (SELECT jsonb_build_object('user_id', r.partner_id, 'full_name', p.full_name)
     FROM ranked r
     LEFT JOIN public.profiles p ON p.id = r.partner_id)
  INTO v_partners, v_partner
  FROM co;

  -- Rule-based archetype (deterministic; the client localizes the KEY):
  --   'grinder'      → lots of hours (>= 100).
  --   'explorer'     → many distinct venues (>= 10).
  --   'social_player'→ many co-players (>= 5).
  --   'park_regular' → outdoor checkins are the majority of sessions.
  --   'casual'       → default.
  -- Ordered so the strongest signal wins; checked top-down.
  IF v_sessions = 0 AND v_events = 0 THEN
    v_archetype := 'casual';
  ELSIF v_hours >= 100 THEN
    v_archetype := 'grinder';
  ELSIF v_venues >= 10 THEN
    v_archetype := 'explorer';
  ELSIF v_partners >= 5 THEN
    v_archetype := 'social_player';
  ELSIF v_sessions > 0 AND v_outdoor * 2 > v_sessions THEN
    v_archetype := 'park_regular';
  ELSE
    v_archetype := 'casual';
  END IF;

  RETURN jsonb_build_object(
    'year', p_year,
    'hours', v_hours,
    'sessions', v_sessions,
    'venues', v_venues,
    'events', v_events,
    'badges', v_badges,
    'milestones', v_milestones,
    'partners', v_partners,
    'top_venue', v_top_venue,
    'top_month', v_top_month,
    'partner_of_year', v_partner,
    'archetype', v_archetype
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.year_in_review(uuid, int) TO authenticated;

-- 2. Mid-December "unlock" teaser fan-out ------------------------------------
-- Self-guards on the date (only acts on/after Dec 15). Nudges ONLY users who
-- actually played this year (>=1 checkin) — no guilt spam — through the 097
-- choke point so the 'wrapped' opt-out is honored. NOT EXISTS de-duped per
-- (year) period; each send wrapped in BEGIN/EXCEPTION so one failure can't
-- abort the batch.
CREATE OR REPLACE FUNCTION public.send_wrapped_teasers()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_year  int := extract(year FROM now())::int;
  v_start timestamptz := make_date(v_year, 1, 1)::timestamptz;
  v_end   timestamptz := make_date(v_year + 1, 1, 1)::timestamptz;
  r RECORD;
BEGIN
  -- Unlock window guard: only run the mid-December teaser on/after Dec 15.
  IF now() < make_date(v_year, 12, 15)::timestamptz THEN
    RETURN;
  END IF;

  FOR r IN
    -- Only users who actually played this year (>=1 checkin) — no guilt spam.
    SELECT DISTINCT c.user_id AS user_id
    FROM public.checkins c
    WHERE c.started_at >= v_start AND c.started_at < v_end
      AND c.user_id IS NOT NULL
      -- De-dupe: at most one 'year_wrapped' per period (year) per user.
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.recipient_id = c.user_id
          AND n.type = 'year_wrapped'
          AND n.data->>'period' = v_year::text
      )
  LOOP
    BEGIN
      PERFORM public.create_and_send_notification(
        r.user_id, NULL, 'year_wrapped',
        'TT Wrapped ' || v_year::text || ' e gata',
        'Anul tău în TT e aici — orele, locațiile, partenerul anului și arhetipul tău. Deschide-l!',
        jsonb_build_object(
          'screen', '/(tabs)/profile',
          'year', v_year::text,
          'period', v_year::text
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send_wrapped_teasers';
    -- Daily at 10:33 throughout December; the function self-guards to act only
    -- on/after Dec 15, and the NOT EXISTS de-dupe makes the daily re-runs send
    -- each user at most once. Minute :33 is a fresh offset distinct from the
    -- weekly/daily jobs (:09, :30, :41, etc).
    PERFORM cron.schedule('send_wrapped_teasers', '33 10 * 12 *',
      $cron$SELECT public.send_wrapped_teasers()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — run send_wrapped_teasers() externally (mid-December).';
  END IF;
END $$;

-- 3. Notification type allowlist + category (reproduce full bodies from 128) ---
-- 129 (milestones) added NO notification type (its celebration is client-side),
-- so 128 holds the authoritative cumulative list (27 types incl 'weekly_recap').
-- Carry it forward in full and append 'year_wrapped'.
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
    'referral_joined',      -- F041
    'streak_reminder',      -- F050
    'weekly_recap',         -- F052
    'year_wrapped'          -- F054
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
    WHEN p_type IN ('streak_reminder') THEN 'streak'
    WHEN p_type IN ('weekly_recap') THEN 'recap'
    WHEN p_type IN ('year_wrapped') THEN 'wrapped'
    ELSE NULL
  END;
$$;

-- 4. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.year_in_review(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_wrapped_teasers() FROM PUBLIC;
-- (year_in_review EXECUTE grant to authenticated is issued above.)

NOTIFY pgrst, 'reload schema';
