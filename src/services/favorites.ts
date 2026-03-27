import { supabase } from '../lib/supabase';

export async function getFavorites(userId: string) {
  return supabase
    .from('favorites')
    .select('id, venue_id, created_at, venues(id, name, city, type, condition)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
}

export async function addFavorite(userId: string, venueId: number) {
  return supabase
    .from('favorites')
    .insert({ user_id: userId, venue_id: venueId })
    .select()
    .single();
}

export async function removeFavorite(userId: string, venueId: number) {
  return supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('venue_id', venueId);
}

export async function isFavorite(userId: string, venueId: number) {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .maybeSingle();

  return { data: !!data, error };
}
