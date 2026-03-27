import { supabase } from '../lib/supabase';
import type { CheckinInsert } from '../types/database';

export async function checkin(data: CheckinInsert) {
  return supabase.from('checkins').insert(data).select().single();
}

export async function checkout(checkinId: number) {
  return supabase
    .from('checkins')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', checkinId)
    .select()
    .single();
}

export async function getActiveCheckins(venueId: number) {
  const now = new Date().toISOString();
  return supabase
    .from('checkins')
    .select('*, profiles(full_name, avatar_url)')
    .eq('venue_id', venueId)
    .gt('ended_at', now)
    .order('started_at', { ascending: false });
}

export async function getActiveFriendCheckins(friendIds: string[]) {
  if (!friendIds.length) return { data: [], error: null };
  const now = new Date().toISOString();
  return supabase
    .from('checkins')
    .select('user_id, venue_id, started_at, venues(name, city)')
    .in('user_id', friendIds)
    .gt('ended_at', now)
    .order('started_at', { ascending: false });
}

export async function getUserActiveCheckin(userId: string, venueId: number) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .gt('ended_at', now)
    .order('started_at', { ascending: false })
    .limit(1);
  return { data: data?.[0] ?? null, error: null };
}

export async function getUserAnyActiveCheckin(userId: string) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('checkins')
    .select('*, venues(name)')
    .eq('user_id', userId)
    .gt('ended_at', now)
    .order('started_at', { ascending: false })
    .limit(1);
  return { data: data?.[0] ?? null, error: null };
}

export async function getPlayHistory(
  userId: string,
  limit = 20,
  offset = 0,
) {
  return supabase
    .from('checkins')
    .select('*, venues(name, city)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);
}

export async function getCheckinStats(userId: string) {
  return supabase
    .from('leaderboard_checkins')
    .select('total_checkins, unique_venues')
    .eq('user_id', userId)
    .single();
}
