import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import { invalidateProfileCache } from '../lib/profileCache';

export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select(
      'id, full_name, email, avatar_url, city, lang, auth_provider, created_at, ' +
        'username, is_admin, notify_friend_checkins',
    )
    .eq('id', userId)
    .single()
    .returns<Profile & { notify_friend_checkins: boolean }>();
}

export async function updateProfile(
  userId: string,
  data: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'city' | 'lang' | 'username'>> & { notify_friend_checkins?: boolean },
) {
  const result = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
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
