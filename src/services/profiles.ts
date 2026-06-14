import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import type { SkillLevel, PlayGoal } from '../lib/playerAttributes';
import { invalidateProfileCache } from '../lib/profileCache';

// Column-level grants (migration 085) exclude email/pending_deletion_at —
// selecting them (or select=*) now errors for the authenticated role. Self
// email comes from auth.getUser()/the session, not from profiles.
const PUBLIC_PROFILE_COLUMNS =
  'id, full_name, avatar_url, city, lang, auth_provider, created_at, ' +
  'username, is_admin, is_moderator, notify_friend_checkins, checkin_visibility, notification_prefs, ' +
  'skill_level, play_goals, home_venue_id, show_as_regular';

export type CheckinVisibility = 'friends' | 'private';

export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('id', userId)
    .single()
    .returns<
      Omit<Profile, 'email'> & {
        notify_friend_checkins: boolean;
        checkin_visibility: CheckinVisibility;
      }
    >();
}

export async function updateProfile(
  userId: string,
  data: Partial<Pick<Profile, 'avatar_url' | 'city' | 'lang'>> & {
    // full_name/username are NOT NULL columns — null is not a valid update.
    full_name?: string;
    username?: string;
    notify_friend_checkins?: boolean;
    checkin_visibility?: CheckinVisibility;
    /** Sparse per-category map (T086): only disabled categories stored. */
    notification_prefs?: Record<string, boolean>;
    /** F001: self-declared skill level (null clears it). */
    skill_level?: SkillLevel | null;
    /** F001: self-declared play goals (multi-select). */
    play_goals?: PlayGoal[];
    /** F014: home venue (null clears it). */
    home_venue_id?: number | null;
    /** F014: opt-in to the home venue's public Regulars list. */
    show_as_regular?: boolean;
  },
) {
  const result = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select(PUBLIC_PROFILE_COLUMNS)
    .single();
  if (!result.error) invalidateProfileCache(userId);
  return result;
}

export async function getProfileStats(userId: string) {
  // Server-side aggregate via get_profile_stats (migration 051).
  // Replaces the previous two-trip implementation that fetched every
  // event_participants row for the user just to sum hours_played
  // client-side — a payload that grew unboundedly with activity.
  const { data, error } = await supabase.rpc('get_profile_stats', { p_user_id: userId });
  const row = Array.isArray(data) ? data[0] : data;
  return {
    data: {
      total_checkins: row?.total_checkins ?? 0,
      unique_venues: row?.unique_venues ?? 0,
      events_joined: row?.events_joined ?? 0,
      total_hours_played: Number(row?.total_hours_played ?? 0),
    },
    error,
  };
}
