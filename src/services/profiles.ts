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
  'skill_level, play_goals, home_venue_id, show_as_regular, referral_code';

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
  const baseRow = Array.isArray(data) ? data[0] : data;
  // F053 widened get_profile_stats (migration 129) with reviews_written +
  // member_since; the generated RPC type lags until types are regenerated, so
  // the row is widened here to read the new columns.
  const row = baseRow as
    | (typeof baseRow & {
        reviews_written?: number;
        member_since?: string | null;
        total_play_hours?: number;
      })
    | null
    | undefined;
  return {
    data: {
      total_checkins: row?.total_checkins ?? 0,
      unique_venues: row?.unique_venues ?? 0,
      events_joined: row?.events_joined ?? 0,
      // Event hours only (the existing "hours in events" surfaces depend on this).
      total_hours_played: Number(row?.total_hours_played ?? 0),
      // F050: weekly play streak, folded into the same RPC (migration 126).
      current_streak: row?.current_streak ?? 0,
      best_streak: row?.best_streak ?? 0,
      // F053: lifetime counters for the milestones strip ghosts (migration 129).
      reviews_written: row?.reviews_written ?? 0,
      member_since: (row?.member_since ?? null) as string | null,
      // F053: combined check-in + event hours — the source the hours milestones
      // are awarded against, so the ghost matches the durable award.
      total_play_hours: Number(row?.total_play_hours ?? row?.total_hours_played ?? 0),
    },
    error,
  };
}
