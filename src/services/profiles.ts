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
  const [checkins, participations] = await Promise.all([
    supabase
      .from('leaderboard_checkins')
      .select('total_checkins, unique_venues')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('event_participants')
      .select('hours_played')
      .eq('user_id', userId),
  ]);

  const rows = participations.data ?? [];
  const totalHoursPlayed = rows.reduce(
    (sum: number, p: { hours_played: number | null }) => sum + (Number(p.hours_played) || 0),
    0,
  );

  return {
    data: {
      total_checkins: checkins.data?.total_checkins ?? 0,
      unique_venues: checkins.data?.unique_venues ?? 0,
      events_joined: rows.length,
      total_hours_played: totalHoursPlayed,
    },
    error: checkins.error || participations.error,
  };
}
