import { supabase } from '../lib/supabase';
import type { CheckinInsert } from '../types/database';

function endOfDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function checkin(data: CheckinInsert) {
  const withExpiry = {
    ...data,
    ended_at: data.ended_at ?? endOfDay(data.started_at),
  };
  return supabase.from('checkins').insert(withExpiry).select().single();
}

export async function checkout(checkinId: number, userId: string) {
  return supabase
    .from('checkins')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', checkinId)
    .eq('user_id', userId)
    .select()
    .single();
}

// Checkin is active if ended_at > now, OR if ended_at is null but started_at is today (fallback: expires end of day)
const activeFilter = (now: string) =>
  `ended_at.gt.${now},and(ended_at.is.null,started_at.gte.${now.split('T')[0]}T00:00:00.000Z)`;

export async function getActiveCheckins(venueId: number) {
  const now = new Date().toISOString();
  return supabase
    .from('checkins')
    .select('*, profiles(full_name, avatar_url)')
    .eq('venue_id', venueId)
    .or(activeFilter(now))
    .order('started_at', { ascending: false });
}

export async function getActiveFriendCheckins(friendIds: string[]) {
  if (!friendIds.length) return { data: [], error: null };
  const now = new Date().toISOString();
  return supabase
    .from('checkins')
    .select('user_id, venue_id, started_at, venues(name, city)')
    .in('user_id', friendIds)
    .or(activeFilter(now))
    .order('started_at', { ascending: false });
}

export async function getUserActiveCheckin(userId: string, venueId: number) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .or(activeFilter(now))
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
    .or(activeFilter(now))
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
  // Fetch checkins and event participations in parallel
  const [checkinsRes, participationsRes] = await Promise.all([
    supabase
      .from('checkins')
      .select('venue_id')
      .eq('user_id', userId),
    supabase
      .from('event_participants')
      .select('events(venue_id)')
      .eq('user_id', userId),
  ]);

  const checkinVenues = (checkinsRes.data ?? []).map((c) => c.venue_id);
  const eventVenues = (participationsRes.data ?? [])
    .map((p: any) => p.events?.venue_id)
    .filter(Boolean);

  const allVenueIds = new Set([...checkinVenues, ...eventVenues]);

  return {
    data: {
      total_checkins: checkinVenues.length,
      unique_venues: allVenueIds.size,
    },
    error: null,
  };
}
