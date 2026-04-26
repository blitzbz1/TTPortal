import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Venue, VenueInsert, VenueType, VenueStats } from '../types/database';
import { escapeLikePattern } from '../lib/auth-utils';
import { invalidateVenueMetaCache } from '../lib/venueDetailCache';
import { removeCacheItemsByPrefix } from '../lib/cacheUtils';

// Drops every cached `venues_*` entry — covers all city scopes.
function invalidateMapVenuesCache() {
  removeCacheItemsByPrefix('venues_');
}

type VenueListRow = Pick<
  Venue,
  | 'id'
  | 'name'
  | 'type'
  | 'city'
  | 'address'
  | 'lat'
  | 'lng'
  | 'tables_count'
  | 'condition'
  | 'free_access'
  | 'night_lighting'
  | 'nets'
  | 'verified'
  | 'approved'
>;

export async function getVenues(city?: string, type?: VenueType) {
  let query = supabase
    .from('venues')
    .select('id, name, type, city, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved')
    .eq('approved', true);

  if (city) query = query.eq('city', city);
  if (type) query = query.eq('type', type);

  const { data: venues, error } = await query.order('name').limit(300).returns<VenueListRow[]>();
  if (error || !venues?.length) return { data: venues ?? [], error };

  const venueIds = venues.map((v) => v.id);
  const { data: stats } = await supabase
    .from('venue_stats')
    .select('venue_id, avg_rating, review_count, checkin_count, favorite_count')
    .in('venue_id', venueIds)
    .returns<VenueStats[]>();

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
    .select(
      'id, name, type, city, county, sector, address, lat, lng, tables_count, condition, ' +
        'hours, description, tags, photos, free_access, night_lighting, nets, verified, ' +
        'tariff, website, submitted_by, approved, created_at',
    )
    .eq('id', id)
    .single()
    .returns<Venue>();

  if (error || !venue) return { data: venue, error };

  const { data: stats } = await supabase
    .from('venue_stats')
    .select('venue_id, avg_rating, review_count, checkin_count, favorite_count')
    .eq('venue_id', id)
    .single()
    .returns<VenueStats>();

  return { data: { ...venue, venue_stats: stats ?? null }, error: null };
}

export async function createVenue(data: VenueInsert) {
  const result = await supabase.from('venues').insert(data).select().single();
  if (!result.error) invalidateMapVenuesCache();
  return result;
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
  const result = await supabase
    .from('venues')
    .update({ photos: [...currentPhotos, newUrl] })
    .eq('id', venueId)
    .select()
    .single();
  if (!result.error) {
    invalidateVenueMetaCache(venueId);
    invalidateMapVenuesCache();
  }
  return result;
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
