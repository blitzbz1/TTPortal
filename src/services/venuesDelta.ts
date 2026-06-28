import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PersistedVenue } from '../lib/venuesPersistentCache';

export interface VenuesDeltaResponse {
  upserts: PersistedVenue[];
  tombstone_ids: number[];
  synced_at: string;
}

export async function getVenuesDelta(
  since: string | null,
  city?: string | null,
  type?: string | null,
  cityId?: number | null,
): Promise<{ data: VenuesDeltaResponse | null; error: PostgrestError | null }> {
  // Reverted to the PROD-deployed get_venues_delta: the slim get_venues_map_delta
  // (Stage 3, migration 138) is NOT on prod, so calling it 404s ("Could not load
  // venues"). get_venues_delta returns the full 17-field row; the extra fields are
  // harmless (PersistedVenue reads the 12 it needs). Switch BACK to
  // 'get_venues_map_delta' (+ bump VENUES_CACHE_SCHEMA_VERSION) only once 138 is
  // deployed to prod — that reclaims the ~39% payload win.
  const { data, error } = await supabase.rpc('get_venues_delta', {
    p_since: since ?? undefined,
    p_city: city ?? undefined,
    p_type: type ?? undefined,
    p_city_id: cityId ?? undefined,
  });
  return { data: (data as VenuesDeltaResponse | null) ?? null, error };
}
