import { supabase } from '../lib/supabase';
import type { VenueInsert, VenueType } from '../types/database';

export async function getVenues(city?: string, type?: VenueType) {
  let query = supabase
    .from('venues')
    .select('id, name, type, city, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved')
    .eq('approved', true);

  if (city) query = query.eq('city', city);
  if (type) query = query.eq('type', type);

  const { data: venues, error } = await query.order('name').limit(300);
  if (error || !venues?.length) return { data: venues ?? [], error };

  const venueIds = venues.map((v) => v.id);
  const { data: stats } = await supabase
    .from('venue_stats')
    .select('*')
    .in('venue_id', venueIds);

  const statsMap = new Map((stats ?? []).map((s) => [s.venue_id, s]));
  const merged = venues.map((v) => ({
    ...v,
    venue_stats: statsMap.get(v.id) ?? null,
  }));

  return { data: merged, error: null };
}

export async function getVenueById(id: number) {
  const { data: venue, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !venue) return { data: venue, error };

  const { data: stats } = await supabase
    .from('venue_stats')
    .select('*')
    .eq('venue_id', id)
    .single();

  return { data: { ...venue, venue_stats: stats ?? null }, error: null };
}

export async function createVenue(data: VenueInsert) {
  return supabase.from('venues').insert(data).select().single();
}

export async function searchVenues(query: string) {
  return supabase
    .from('venues')
    .select('id, name, type, city, lat, lng, condition')
    .eq('approved', true)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20);
}
