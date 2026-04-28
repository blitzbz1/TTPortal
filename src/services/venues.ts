import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Venue, VenueInsert, VenueStats } from '../types/database';
import { invalidateVenueMetaCache } from '../lib/venueDetailCache';
import { removeCacheItemsByPrefix } from '../lib/cacheUtils';

// Drops every cached `venues_*` entry — covers all city scopes.
function invalidateMapVenuesCache() {
  removeCacheItemsByPrefix('venues_');
}

// `getVenues` was previously the imperative path used by VenuePickerModal.
// That caller now reads from the delta-synced cache via `useVenuesQuery`,
// and every other surface (MapViewScreen) was already on the hook. Keep
// the file small — there's nothing left to expose here for the venue
// list, only the create / update / search / by-id helpers below.

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
      .upload(path, uploadData, {
        contentType,
        upsert: false,
        // Long cache: every upload gets a unique timestamped path, so the
        // URL itself acts as the cache-buster — clients can cache forever
        // and we never need to invalidate. 30 days is the practical cap
        // most CDNs respect; immutable signals "the URL won't change".
        cacheControl: 'public, max-age=2592000, immutable',
      });

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

