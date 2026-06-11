-- Migration: 097_notification_preferences (T086)
-- Per-category notification preference center.
--
-- Every fan-out path (friendship/check-in/event/review/feedback triggers +
-- the reminder/feedback crons) already funnels through
-- public.create_and_send_notification — so consulting preferences there
-- gates ALL of them in one choke point, in-app row and push alike.
--
-- Storage: sparse jsonb on profiles — only categories the user has turned
-- OFF are stored ({"events": false}); everything defaults to enabled. The
-- legacy notify_friend_checkins boolean (012) keeps working: it is folded
-- into the helper below and backfilled into the new map.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: users who already disabled friend check-ins carry it over.
UPDATE public.profiles
SET notification_prefs = notification_prefs || '{"friend_checkins": false}'::jsonb
WHERE notify_friend_checkins = false;

-- Maps a notification `type` to its preference category. New types default
-- to a category here; unknown types are always delivered (fail-open: a
-- forgotten mapping must not silently drop notifications).
CREATE OR REPLACE FUNCTION public.notification_category(p_type TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type IN ('friend_request', 'friend_accepted') THEN 'friend_requests'
    WHEN p_type IN ('checkin', 'checkin_nearby', 'friend_checkin') THEN 'friend_checkins'
    WHEN p_type IN ('event_reminder', 'event_update', 'event_cancelled', 'event_joined',
                    'event_invite', 'event_challenge',
                    'event_feedback_request', 'event_feedback_received') THEN 'events'
    WHEN p_type IN ('review', 'review_on_venue') THEN 'reviews_on_my_venue'
    WHEN p_type IN ('feedback_reply') THEN 'feedback_replies'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.notification_pref_enabled(p_user UUID, p_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category TEXT;
  v_prefs JSONB;
  v_legacy BOOLEAN;
BEGIN
  v_category := public.notification_category(p_type);
  IF v_category IS NULL THEN
    RETURN TRUE; -- unmapped type: fail-open
  END IF;

  SELECT notification_prefs, notify_friend_checkins
  INTO v_prefs, v_legacy
  FROM public.profiles WHERE id = p_user;

  IF v_prefs IS NULL THEN
    RETURN TRUE; -- recipient profile missing: let the FK sort it out
  END IF;

  -- Legacy single toggle still authoritative for its category when set off.
  IF v_category = 'friend_checkins' AND v_legacy = FALSE THEN
    RETURN FALSE;
  END IF;

  RETURN COALESCE((v_prefs ->> v_category)::boolean, TRUE);
END;
$$;

-- Recreate the single choke point with the pref gate. Signature unchanged —
-- every existing trigger/cron picks this up without being touched.
CREATE OR REPLACE FUNCTION public.create_and_send_notification(
  p_recipient_id UUID,
  p_sender_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Don't notify yourself
  IF p_recipient_id = p_sender_id THEN
    RETURN;
  END IF;

  -- Preference center (097): per-category opt-out gates the in-app row AND
  -- the push in one place.
  IF NOT public.notification_pref_enabled(p_recipient_id, p_type) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
  VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_data);

  PERFORM public.send_push_notification(p_recipient_id, p_title, p_body, p_data);
END;
$$ LANGUAGE plpgsql;

-- The column-list grant from 085 must include the new column so users can
-- read/write their own prefs (RLS still scopes rows to self for writes).
GRANT SELECT (notification_prefs) ON public.profiles TO authenticated;
GRANT UPDATE (notification_prefs) ON public.profiles TO authenticated;
