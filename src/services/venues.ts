import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { VenueInsert, VenueType } from '../types/database';
import { escapeLikePattern } from '../lib/auth-utils';

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

export async function uploadVenuePhoto(venueId: number, fileUri: string): Promise<{ url: string | null; error: string | null }> {
  try {
    const path = `venues/${venueId}/${Date.now()}.jpg`;

    let uploadData: any;
    let contentType: string;

    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      uploadData = await response.blob();
      contentType = 'image/jpeg';
    } else {
      // Native: FormData with file URI — proven pattern for Supabase Storage on RN
      const formData = new FormData();
      formData.append('', {
        uri: fileUri,
        name: `${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
      uploadData = formData;
      contentType = 'multipart/form-data';
    }

    const { error: uploadError } = await supabase.storage
      .from('venue-photos')
      .upload(path, uploadData, { contentType, upsert: false });

    if (uploadError) return { url: null, error: uploadError.message };

    const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (err: any) {
    return { url: null, error: err?.message || 'Upload failed' };
  }
}

export async function addPhotoToVenue(venueId: number, currentPhotos: string[], newUrl: string) {
  return supabase
    .from('venues')
    .update({ photos: [...currentPhotos, newUrl] })
    .eq('id', venueId)
    .select()
    .single();
}

export async function searchVenues(query: string) {
  return supabase
    .from('venues')
    .select('id, name, type, city, lat, lng, condition')
    .eq('approved', true)
    .ilike('name', `%${escapeLikePattern(query)}%`)
    .order('name')
    .limit(20);
}
