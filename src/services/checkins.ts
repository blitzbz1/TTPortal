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
  const result = await supabase
    .from('checkins')
    .select('id, user_id, venue_id, started_at, ended_at, venues(name, city)')
    .in('user_id', friendIds)
    .or(activeFilter(now))
    .order('started_at', { ascending: false });

  if (result.error || !result.data?.length) return result;

  // Resolve friend profile names separately (checkins.user_id FKs auth.users, not profiles).
  const userIds = Array.from(new Set(result.data.map((c: { user_id: string }) => c.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  const nameById = new Map<string, string | null>(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
  );

  return {
    ...result,
    data: result.data.map((c: { user_id: string }) => ({
      ...c,
      profiles: { full_name: nameById.get(c.user_id) ?? null },
    })),
  };
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

export async function getVenueChampion(venueId: number) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get all checkins in last 30 days, then deduplicate per user per day client-side
  const { data, error } = await supabase
    .from('checkins')
    .select('user_id, started_at, profiles(full_name)')
    .eq('venue_id', venueId)
    .gte('started_at', thirtyDaysAgo)
    .order('started_at', { ascending: false });

  if (error || !data?.length) return { data: null, error };

  // Count unique days per user
  const userDays = new Map<string, Set<string>>();
  const userNames = new Map<string, string>();

  for (const row of data) {
    const day = row.started_at.split('T')[0];
    if (!userDays.has(row.user_id)) userDays.set(row.user_id, new Set());
    userDays.get(row.user_id)!.add(day);
    if (!userNames.has(row.user_id)) {
      userNames.set(row.user_id, (row as any).profiles?.full_name ?? '?');
    }
  }

  // Find the user with most unique days
  let championId = '';
  let maxDays = 0;
  for (const [userId, days] of userDays) {
    if (days.size > maxDays) {
      maxDays = days.size;
      championId = userId;
    }
  }

  if (!championId || maxDays < 2) return { data: null, error: null }; // Need at least 2 days to be champion

  return {
    data: {
      userId: championId,
      fullName: userNames.get(championId) ?? '?',
      dayCount: maxDays,
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
