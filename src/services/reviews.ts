import { supabase } from '../lib/supabase';
import type { ReviewInsert } from '../types/database';
import { invalidateVenueReviewsCache } from '../lib/venueDetailCache';

export async function getReviewsForVenue(venueId: number) {
  // Fetch reviews and the caller's user_blocks in parallel; filter out
  // blocked users' reviews client-side. RLS limits user_blocks to rows
  // where blocker_id = auth.uid(), so the second query returns nothing
  // for signed-out callers (which is the correct behavior — no filter).
  const [reviewsResult, blocksResult] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, venue_id, user_id, reviewer_name, rating, body, created_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('user_blocks').select('blocked_id'),
  ]);

  if (reviewsResult.error) return reviewsResult;

  const blocked = new Set(
    (blocksResult.data ?? []).map((row) => row.blocked_id as string),
  );
  if (blocked.size === 0) return reviewsResult;

  return {
    ...reviewsResult,
    data: (reviewsResult.data ?? []).filter(
      (r) => !r.user_id || !blocked.has(r.user_id),
    ),
  };
}

export async function createReview(data: ReviewInsert) {
  // One review per user per venue (migration 086): re-submitting replaces
  // the user's existing review in place.
  const result = await supabase
    .from('reviews')
    .upsert(data, { onConflict: 'user_id,venue_id' })
    .select()
    .single();
  if (!result.error) invalidateVenueReviewsCache(data.venue_id);
  return result;
}

export async function getUserReviewCount(userId: string) {
  const { count, error } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return { data: count ?? 0, error };
}
