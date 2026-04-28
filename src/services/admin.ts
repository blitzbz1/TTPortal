import { supabase } from '../lib/supabase';
import { removeCacheItemsByPrefix } from '../lib/cacheUtils';
import { invalidateVenueMetaCache, invalidateVenueReviewsCache } from '../lib/venueDetailCache';

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
    .select('*')
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
  }
  return result;
}

export async function rejectVenue(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  const result = await supabase.from('venues').delete().eq('id', id);
  if (!result.error) {
    invalidateMapVenuesCache();
    invalidateVenueMetaCache(id);
  }
  return result;
}

export async function searchVenuesAdmin(query: string) {
  const pattern = `%${query}%`;
  return supabase
    .from('venues')
    .select('id, name, city, address, type, tables_count, lat, lng, description, approved')
    .or(`name.ilike.${pattern},address.ilike.${pattern}`)
    .order('name')
    .limit(30);
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
  }
  return result;
}

export async function getFlaggedReviews() {
  // Keep the `venues!venue_id` embed — that FK does point to public.venues.
  // Only the profiles embed is broken (FK lands on auth.users).
  const result = await supabase
    .from('reviews')
    .select('*, venues!venue_id(name)')
    .eq('flagged', true)
    .order('flag_count', { ascending: false });
  if (result.error || !result.data) return result;
  const data = await attachProfiles(result.data, 'user_id', 'profiles', 'full_name');
  return { ...result, data };
}

export async function keepReview(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  return supabase
    .from('reviews')
    .update({ flagged: false, flag_count: 0 })
    .eq('id', id)
    .select()
    .single();
}

export async function deleteReview(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  return supabase.from('reviews').delete().eq('id', id);
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
  return supabase.from('user_feedback').delete().eq('id', id);
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
