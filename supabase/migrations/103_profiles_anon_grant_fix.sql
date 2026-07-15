-- Migration: 103_profiles_anon_grant_fix
-- 085 revoked SELECT on profiles from anon entirely, reasoning "anon had
-- no row access anyway" (002's RLS policy is TO authenticated). True for
-- direct selects — but PostgREST EMBEDS need the table-level grant before
-- RLS even applies, so every anonymous query embedding profiles started
-- hard-failing with 42501 ("permission denied for table profiles"). Field
-- symptom: the Events tab showed "Could not load events." for signed-out
-- users (the list embeds participant profiles).
--
-- Fix: re-grant the same public column list to anon. RLS is unchanged
-- (TO authenticated), so anon still receives NULL/empty profile rows in
-- embeds — exactly the pre-085 behavior, with email/pending_deletion_at
-- still excluded for everyone.

GRANT SELECT (
  id,
  full_name,
  avatar_url,
  city,
  lang,
  auth_provider,
  created_at,
  username,
  is_admin,
  is_moderator,
  notify_friend_checkins,
  checkin_visibility,
  notification_prefs
) ON public.profiles TO anon;
