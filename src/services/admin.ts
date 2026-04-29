import { supabase } from '../lib/supabase';
import { removeCacheItemsByPrefix } from '../lib/cacheUtils';
import { invalidateVenueMetaCache, invalidateVenueReviewsCache } from '../lib/venueDetailCache';
import {
  invalidateFlaggedReviewsCache,
  invalidatePendingVenuesCache,
  invalidateUserFeedbackCache,
} from '../lib/adminListsCache';

// Slim column lists for the admin moderation lists. The admin UI renders
// pending-venue cards with name/city/address/created_at/submitter, and the
// edit modal touches name/address/city/type/tables_count/description/lat/lng
// — fetching the full row roughly halves egress on this endpoint.
const PENDING_VENUE_COLS =
  'id, name, type, city, address, lat, lng, tables_count, description, submitted_by, created_at';
// Flagged-review cards render author, venue name, flag count and date — the
// review body itself is not shown in the list.
const FLAGGED_REVIEW_COLS =
  'id, user_id, venue_id, flag_count, flagged, created_at, comment, rating';

function invalidateMapVenuesCache() {
  removeCacheItemsByPrefix('venues_');
}

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

// Several admin queries used to PostgREST-embed profiles via the `<col>` FK
// (e.g. `profiles!user_id(full_name)`). That works only when the embedded
// FK actually points at `public.profiles`. In this schema the user-id FKs
// point at `auth.users`, so PostgREST returns 400 "no relationship found".
// Workaround: load profiles in a second query keyed by id and stitch them
// onto each row under the same field name the UI already reads.
async function attachProfiles<T extends Record<string, any>>(
  rows: T[],
  idKey: keyof T,
  fieldName: string,
  columns: string,
): Promise<T[]> {
  const ids = Array.from(
    new Set(
      rows
        .map((r) => r[idKey])
        .filter((id) => typeof id === 'string') as string[],
    ),
  );
  if (ids.length === 0) return rows.map((r) => ({ ...r, [fieldName]: null }));
  const { data } = await supabase.from('profiles').select(`id, ${columns}`).in('id', ids);
  const byId = new Map<string, any>();
  (data ?? []).forEach((p: any) => byId.set(p.id, p));
  return rows.map((r) => ({
    ...r,
    [fieldName]: r[idKey] && byId.has(r[idKey] as string) ? byId.get(r[idKey] as string) : null,
  }));
}

export async function getPendingVenues() {
  const result = await supabase
    .from('venues')
    .select(PENDING_VENUE_COLS)
    .eq('approved', false)
    .order('created_at', { ascending: false });
  if (result.error || !result.data) return result;
  const data = await attachProfiles(result.data, 'submitted_by', 'profiles', 'full_name');
  return { ...result, data };
}

export async function approveVenue(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase
    .from('venues')
    .update({ approved: true })
    .eq('id', id)
    .select()
    .single();
  if (!result.error) {
    invalidateMapVenuesCache();
    invalidateVenueMetaCache(id);
    invalidatePendingVenuesCache();
  }
  return result;
}

export async function rejectVenue(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase.from('venues').delete().eq('id', id);
  if (!result.error) {
    invalidateMapVenuesCache();
    invalidateVenueMetaCache(id);
    invalidatePendingVenuesCache();
  }
  return result;
}

export async function searchVenuesAdmin(query: string) {
  // Diacritic-insensitive search via the search_venues_admin RPC
  // (migration 050) — uses Postgres `unaccent()` so "bucuresti" matches
  // "București". The RPC returns full venue rows; we project here to
  // keep the wire payload slim.
  const { data, error } = await supabase.rpc('search_venues_admin', {
    p_query: query,
    p_limit: 30,
  });
  if (error || !data) return { data: data ?? [], error };
  const slim = (data as any[]).map((v) => ({
    id: v.id, name: v.name, city: v.city, address: v.address, type: v.type,
    tables_count: v.tables_count, lat: v.lat, lng: v.lng,
    description: v.description, approved: v.approved,
  }));
  return { data: slim, error: null };
}

export async function updateVenue(
  id: number,
  userId: string,
  updates: {
    name?: string;
    address?: string;
    city?: string;
    city_id?: number;
    type?: string;
    tables_count?: number | null;
    description?: string | null;
    lat?: number | null;
    lng?: number | null;
  },
) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase.from('venues').update(updates).eq('id', id).select().single();
  if (!result.error) {
    invalidateMapVenuesCache();
    invalidateVenueMetaCache(id);
  }
  return result;
}

export async function deleteVenue(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase.from('venues').delete().eq('id', id);
  if (!result.error) {
    invalidateMapVenuesCache();
    invalidateVenueMetaCache(id);
    invalidateVenueReviewsCache(id);
    invalidatePendingVenuesCache();
    invalidateFlaggedReviewsCache();
  }
  return result;
}

export async function getFlaggedReviews() {
  // Keep the `venues!venue_id` embed — that FK does point to public.venues.
  // Only the profiles embed is broken (FK lands on auth.users).
  const result = await supabase
    .from('reviews')
    .select(`${FLAGGED_REVIEW_COLS}, venues!venue_id(name)`)
    .eq('flagged', true)
    .order('flag_count', { ascending: false });
  if (result.error || !result.data) return result;
  const data = await attachProfiles(result.data, 'user_id', 'profiles', 'full_name');
  return { ...result, data };
}

export async function keepReview(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase
    .from('reviews')
    .update({ flagged: false, flag_count: 0 })
    .eq('id', id)
    .select()
    .single();
  if (!result.error) invalidateFlaggedReviewsCache();
  return result;
}

export async function deleteReview(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase.from('reviews').delete().eq('id', id);
  if (!result.error) invalidateFlaggedReviewsCache();
  return result;
}

export async function getUserFeedback(limit = 100) {
  const result = await supabase
    .from('user_feedback')
    .select('id, user_id, page, category, message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (result.error || !result.data) return result;
  const data = await attachProfiles(result.data, 'user_id', 'profiles', 'full_name, email');
  return { ...result, data };
}

export async function deleteUserFeedback(id: string, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase.from('user_feedback').delete().eq('id', id);
  if (!result.error) invalidateUserFeedbackCache();
  return result;
}

export async function getFeedbackReplies(feedbackId: string) {
  const result = await supabase
    .from('feedback_replies')
    .select('id, feedback_id, admin_id, reply_text, created_at')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true });
  if (result.error || !result.data) return result;
  const data = await attachProfiles(result.data, 'admin_id', 'profiles', 'full_name');
  return { ...result, data };
}

export async function replyToFeedback(feedbackId: string, adminId: string, replyText: string) {
  if (!await verifyAdmin(adminId)) return { data: null, error: { message: 'Unauthorized' } };
  const trimmed = replyText.trim();
  if (!trimmed) return { data: null, error: { message: 'Reply text is required' } };
  return supabase
    .from('feedback_replies')
    .insert({ feedback_id: feedbackId, admin_id: adminId, reply_text: trimmed })
    .select()
    .single();
}
