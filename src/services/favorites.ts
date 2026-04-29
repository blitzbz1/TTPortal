import { supabase } from '../lib/supabase';
import { invalidateFavoritesCache } from '../lib/favoritesCache';

export async function getFavorites(userId: string) {
  return supabase
    .from('favorites')
    .select('id, venue_id, created_at, venues(id, name, city, type, condition)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
}

export async function addFavorite(userId: string, venueId: number) {
  const result = await supabase
    .from('favorites')
    .insert({ user_id: userId, venue_id: venueId })
    .select()
    .single();
  if (!result.error) invalidateFavoritesCache(userId);
  return result;
}

export async function removeFavorite(userId: string, venueId: number) {
  const result = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('venue_id', venueId);
  if (!result.error) invalidateFavoritesCache(userId);
  return result;
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
