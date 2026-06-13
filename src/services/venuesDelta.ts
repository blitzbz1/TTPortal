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
  const { data, error } = await supabase.rpc('get_venues_delta', {
    p_since: since ?? undefined,
    p_city: city ?? undefined,
    p_type: type ?? undefined,
    p_city_id: cityId ?? undefined,
  });
  return { data: (data as VenuesDeltaResponse | null) ?? null, error };
}
