import { supabase } from '../lib/supabase';

const VIEW_MAP = {
  checkins: 'leaderboard_checkins',
  reviews: 'leaderboard_reviews',
  venues: 'leaderboard_venues',
} as const;

export async function getLeaderboard(
  type: 'checkins' | 'reviews' | 'venues',
  city?: string,
) {
  let query = supabase
    .from(VIEW_MAP[type])
    .select('*')
    .order('rank', { ascending: true })
    .limit(50);

  if (city) query = query.eq('city', city);

  return query;
}
