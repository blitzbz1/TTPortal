import { supabase } from '../lib/supabase';
import type { CheckinInsert } from '../types/database';
import { invalidatePlayHistoryCache } from '../lib/playHistoryCache';
import { invalidateProfileStatsCache } from '../lib/profileCache';

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
  const result = await supabase.from('checkins').insert(withExpiry).select().single();
  if (!result.error && data.user_id) {
    invalidatePlayHistoryCache(data.user_id);
    invalidateProfileStatsCache(data.user_id);
  }
  return result;
}

export async function checkout(checkinId: number, userId: string) {
  const result = await supabase
    .from('checkins')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', checkinId)
    .eq('user_id', userId)
    .select()
    .single();
  if (!result.error) {
    invalidatePlayHistoryCache(userId);
    invalidateProfileStatsCache(userId);
  }
  return result;
}

// Checkin is active if ended_at > now, OR if ended_at is null but started_at is today (fallback: expires end of day)
const activeFilter = (now: string) =>
  `ended_at.gt.${now},and(ended_at.is.null,started_at.gte.${now.split('T')[0]}T00:00:00.000Z)`;

export async function getActiveCheckins(venueId: number) {
  const now = new Date().toISOString();
  return supabase
    .from('checkins')
    .select(
      'id, user_id, venue_id, table_number, started_at, ended_at, profiles!checkins_user_profiles_fk(full_name, avatar_url)',
    )
    .eq('venue_id', venueId)
    .or(activeFilter(now))
    .order('started_at', { ascending: false });
}

export async function getActiveFriendCheckins(friendIds: string[]) {
  if (!friendIds.length) return { data: [], error: null };
  const now = new Date().toISOString();
  // Single query: embed profiles via the checkins→profiles FK added in migration 038.
  return supabase
    .from('checkins')
    .select('id, user_id, venue_id, started_at, ended_at, venues(name, city), profiles!checkins_user_profiles_fk(full_name)')
    .in('user_id', friendIds)
    .or(activeFilter(now))
    .order('started_at', { ascending: false });
}

export async function getUserActiveCheckin(userId: string, venueId: number) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('checkins')
    .select('id, user_id, venue_id, table_number, started_at, ended_at')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .or(activeFilter(now))
    .order('started_at', { ascending: false })
    .limit(1);
  return { data: data?.[0] ?? null, error: null };
}

type ActiveCheckinWithVenueName = {
  id: number;
  user_id: string;
  venue_id: number;
  table_number: number | null;
  started_at: string;
  ended_at: string | null;
  venues: { name: string } | null;
};

export async function getUserAnyActiveCheckin(userId: string) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('checkins')
    .select('id, user_id, venue_id, table_number, started_at, ended_at, venues(name)')
    .eq('user_id', userId)
    .or(activeFilter(now))
    .order('started_at', { ascending: false })
    .limit(1)
    .returns<ActiveCheckinWithVenueName[]>();
  return { data: data?.[0] ?? null, error: null };
}

export async function getPlayHistory(
  userId: string,
  limit = 20,
  offset = 0,
  since?: string | null,
) {
  let query = supabase
    .from('checkins')
    .select('id, user_id, venue_id, started_at, ended_at, venues(name, city)')
    .eq('user_id', userId);
  if (since) query = query.gte('started_at', since);
  return query
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);
}

export async function getVenueChampion(venueId: number) {
  // Server-side aggregation via RPC (migration 043). Returns at most one row
  // — the user with the most distinct active days at this venue in the last
  // 30 days, requiring at least 2 days to qualify.
  const { data, error } = await supabase.rpc('get_venue_champion', {
    p_venue_id: venueId,
    p_days_back: 30,
  });

  if (error || !data || data.length === 0) return { data: null, error };

  const row = data[0] as { user_id: string; full_name: string | null; day_count: number };
  return {
    data: {
      userId: row.user_id,
      fullName: row.full_name ?? '?',
      dayCount: Number(row.day_count),
    },
    error: null,
  };
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
