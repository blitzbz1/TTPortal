import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
}

export async function updateProfile(
  userId: string,
  data: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'city' | 'lang' | 'username'>> & { notify_friend_checkins?: boolean },
) {
  return supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
    .single();
}

export async function getProfileStats(userId: string) {
  const [checkins, events, feedback] = await Promise.all([
    supabase
      .from('leaderboard_checkins')
      .select('total_checkins, unique_venues')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('event_participants')
      .select('event_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('event_feedback')
      .select('hours_played')
      .eq('user_id', userId),
  ]);

  const totalHoursPlayed = (feedback.data ?? []).reduce(
    (sum: number, f: { hours_played: number | null }) => sum + (Number(f.hours_played) || 0),
    0,
  );

  return {
    data: {
      total_checkins: checkins.data?.total_checkins ?? 0,
      unique_venues: checkins.data?.unique_venues ?? 0,
      events_joined: events.count ?? 0,
      total_hours_played: totalHoursPlayed,
    },
    error: checkins.error || events.error || feedback.error,
  };
}
