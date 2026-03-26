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
  return supabase
    .from('checkins')
    .select('*, profiles(full_name, avatar_url)')
    .eq('venue_id', venueId)
    .is('ended_at', null)
    .order('started_at', { ascending: false });
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
