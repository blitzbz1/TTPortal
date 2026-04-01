import { supabase } from '../lib/supabase';

const VIEW_MAP = {
  checkins: 'leaderboard_checkins',
  reviews: 'leaderboard_reviews',
  venues: 'leaderboard_venues',
} as const;

export async function getLeaderboard(
  type: 'checkins' | 'reviews' | 'venues',
  city?: string,
  period?: 'week' | 'all',
) {
  if (period === 'week') {
    return getWeeklyLeaderboard(type, city);
  }

  let query = supabase
    .from(VIEW_MAP[type])
    .select('*')
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

  if (type === 'checkins') {
    const { data, error } = await supabase
      .rpc('weekly_leaderboard_checkins', { since: sevenDaysAgo })
      .limit(20);

    if (error) {
      // Fallback: query directly
      return queryWeeklyCheckins(sevenDaysAgo, city);
    }
    return { data: data ?? [], error: null };
  }

  if (type === 'reviews') {
    return queryWeeklyReviews(sevenDaysAgo, city);
  }

  // venues
  return queryWeeklyVenues(sevenDaysAgo, city);
}

async function queryWeeklyCheckins(since: string, _city?: string) {
  const { data, error } = await supabase
    .from('checkins')
    .select('user_id, profiles!inner(full_name)')
    .gte('started_at', since);

  if (error || !data) return { data: [], error };

  const counts: Record<string, { user_id: string; full_name: string; total_checkins: number }> = {};
  for (const row of data as any[]) {
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
  for (const row of data as any[]) {
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
