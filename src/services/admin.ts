import { supabase } from '../lib/supabase';

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export async function getPendingVenues() {
  return supabase
    .from('venues')
    .select('*, profiles!submitted_by(full_name)')
    .eq('approved', false)
    .order('created_at', { ascending: false });
}

export async function approveVenue(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  return supabase
    .from('venues')
    .update({ approved: true })
    .eq('id', id)
    .select()
    .single();
}

export async function rejectVenue(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  return supabase.from('venues').delete().eq('id', id);
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
  updates: { name?: string; address?: string; city?: string; type?: string; tables_count?: number | null; description?: string | null },
) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  return supabase.from('venues').update(updates).eq('id', id).select().single();
}

export async function deleteVenue(id: number, userId: string) {
  if (!await verifyAdmin(userId)) return { data: null, error: { message: 'Unauthorized' } };
  return supabase.from('venues').delete().eq('id', id);
}

export async function getFlaggedReviews() {
  return supabase
    .from('reviews')
    .select('*, profiles!user_id(full_name), venues!venue_id(name)')
    .eq('flagged', true)
    .order('flag_count', { ascending: false });
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
