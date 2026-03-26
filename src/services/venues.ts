import { supabase } from '../lib/supabase';
import type { VenueInsert, VenueType } from '../types/database';

export async function getVenues(city?: string, type?: VenueType) {
  let query = supabase
    .from('venues')
    .select('*')
    .eq('approved', true);

  if (city) query = query.eq('city', city);
  if (type) query = query.eq('type', type);

  return query.order('name');
}

export async function getVenueById(id: number) {
  return supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .single();
}

export async function createVenue(data: VenueInsert) {
  return supabase.from('venues').insert(data).select().single();
}

export async function searchVenues(query: string) {
  return supabase
    .from('venues')
    .select('*')
    .eq('approved', true)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20);
}
