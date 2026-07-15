import { supabase } from '../lib/supabase';

// F033 ladder RPCs (migration 122) aren't in the generated types yet; bound
// shim avoids the rpc this-binding bug (commit 2032f23).
type RpcResponse<T> = Promise<{ data: T | null; error: unknown }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export interface LadderEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  played: number;
  wins: number;
  rating: number;
  rank: number;
  score: number;
}

export interface LadderStanding {
  played: number;
  placed: boolean;
  rank: number | null;
  needed: number;
  season?: string;
}

export async function getCityLadder(city?: string, seasonId?: number | null): Promise<{ data: LadderEntry[]; error: unknown }> {
  const { data, error } = await callRpc('get_city_ladder', {
    p_city: city ?? null,
    p_season_id: seasonId ?? null,
    p_limit: 50,
  });
  return { data: (data as LadderEntry[]) ?? [], error };
}

export async function getMyLadderStanding(city?: string): Promise<{ data: LadderStanding | null; error: unknown }> {
  const { data, error } = await callRpc('get_my_ladder_standing', { p_city: city ?? null });
  return { data: (data as LadderStanding) ?? null, error };
}

const VIEW_MAP = {
  checkins: 'leaderboard_checkins',
  reviews: 'leaderboard_reviews',
  venues: 'leaderboard_venues',
} as const;

// Per-view column lists. The shared header columns (user_id, full_name,
// avatar_url, city, rank) are used by every variant; the score columns
// vary. Pinning these columns instead of `select('*')` keeps the wire
// payload small and protects against silent bloat if the views ever
// gain bookkeeping columns.
const COLUMN_MAP: Record<keyof typeof VIEW_MAP, string> = {
  checkins: 'user_id, full_name, avatar_url, city, total_checkins, unique_venues, rank',
  reviews:  'user_id, full_name, avatar_url, city, total_reviews, avg_given_rating, rank',
  venues:   'user_id, full_name, avatar_url, city, venues_added, rank',
};

export async function getLeaderboard(
  type: 'checkins' | 'reviews' | 'venues' | 'ladder',
  city?: string,
  period?: 'week' | 'all',
) {
  if (type === 'ladder') {
    return getCityLadder(city);
  }
  if (period === 'week') {
    return getWeeklyLeaderboard(type, city);
  }

  let query = supabase
    .from(VIEW_MAP[type])
    .select(COLUMN_MAP[type])
    .order('rank', { ascending: true })
    .limit(50);

  if (city) query = query.eq('city', city);

  return query;
}

async function getWeeklyLeaderboard(
  type: 'checkins' | 'reviews' | 'venues',
  city?: string,
) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rpcName =
    type === 'checkins'
      ? 'weekly_leaderboard_checkins'
      : type === 'reviews'
        ? 'weekly_leaderboard_reviews'
        : 'weekly_leaderboard_venues';

  const { data, error } = await supabase.rpc(rpcName, { since: sevenDaysAgo });

  if (error) {
    // Fallback: client-side aggregation. Should be rare — the RPCs were added
    // in migration 040 and grant EXECUTE to authenticated and anon.
    if (type === 'checkins') return queryWeeklyCheckins(sevenDaysAgo, city);
    if (type === 'reviews') return queryWeeklyReviews(sevenDaysAgo, city);
    return queryWeeklyVenues(sevenDaysAgo, city);
  }
  return { data: data ?? [], error: null };
}

async function queryWeeklyCheckins(since: string, _city?: string) {
  const { data, error } = await supabase
    .from('checkins')
    .select('user_id, profiles!inner(full_name)')
    .gte('started_at', since);

  if (error || !data) return { data: [], error };

  const counts: Record<string, { user_id: string; full_name: string; total_checkins: number }> = {};
  for (const row of data as { user_id: string; profiles?: { full_name?: string | null } | null }[]) {
    const uid = row.user_id;
    if (!counts[uid]) {
      counts[uid] = {
        user_id: uid,
        full_name: row.profiles?.full_name ?? '',
        total_checkins: 0,
      };
    }
    counts[uid].total_checkins += 1;
  }

  const sorted = Object.values(counts)
    .sort((a, b) => b.total_checkins - a.total_checkins)
    .slice(0, 20)
    .map((entry, idx) => ({ ...entry, rank: idx + 1, score: entry.total_checkins }));

  return { data: sorted, error: null };
}

async function queryWeeklyReviews(since: string, _city?: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('user_id, profiles!inner(full_name)')
    .gte('created_at', since);

  if (error || !data) return { data: [], error };

  const counts: Record<string, { user_id: string; full_name: string; total_reviews: number }> = {};
  for (const row of data as { user_id: string; profiles?: { full_name?: string | null } | null }[]) {
    const uid = row.user_id;
    if (!counts[uid]) {
      counts[uid] = {
        user_id: uid,
        full_name: row.profiles?.full_name ?? '',
        total_reviews: 0,
      };
    }
    counts[uid].total_reviews += 1;
  }

  const sorted = Object.values(counts)
    .sort((a, b) => b.total_reviews - a.total_reviews)
    .slice(0, 20)
    .map((entry, idx) => ({ ...entry, rank: idx + 1, score: entry.total_reviews }));

  return { data: sorted, error: null };
}

async function queryWeeklyVenues(since: string, _city?: string) {
  const { data, error } = await supabase
    .from('venues')
    .select('id, created_at')
    .gte('created_at', since);

  if (error || !data) return { data: [], error };

  // For venues, we count venues created in the last week (no user grouping makes sense,
  // so we return the same format with a placeholder)
  const sorted = (data as any[])
    .slice(0, 20)
    .map((entry, idx) => ({
      user_id: entry.id?.toString() ?? '',
      full_name: entry.name ?? '',
      unique_venues: 1,
      rank: idx + 1,
      score: 1,
    }));

  return { data: sorted, error: null };
}
