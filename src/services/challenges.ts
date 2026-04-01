import { supabase } from '../lib/supabase';

export async function getMonthlyStats(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [checkinsRes, reviewsRes] = await Promise.all([
    supabase
      .from('checkins')
      .select('venue_id')
      .eq('user_id', userId)
      .gte('started_at', startOfMonth),
    supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth),
  ]);

  const checkins = checkinsRes.data ?? [];
  const uniqueVenues = new Set(checkins.map((c) => c.venue_id));

  return {
    monthCheckins: checkins.length,
    monthVenues: uniqueVenues.size,
    monthReviews: (reviewsRes.data ?? []).length,
  };
}
