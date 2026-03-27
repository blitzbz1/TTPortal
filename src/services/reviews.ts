import { supabase } from '../lib/supabase';
import type { ReviewInsert } from '../types/database';

export async function getReviewsForVenue(venueId: number) {
  return supabase
    .from('reviews')
    .select('id, venue_id, user_id, reviewer_name, rating, body, created_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(50);
}

export async function createReview(data: ReviewInsert) {
  return supabase.from('reviews').insert(data).select().single();
}

export async function flagReview(id: number) {
  return supabase.rpc('flag_review', { review_id: id });
}
