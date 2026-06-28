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
  // Stage 3: the slim 12-field projection (same {upserts,tombstone_ids,synced_at}
  // envelope + same 4 args; only the per-row shape shrank).
  const { data, error } = await supabase.rpc('get_venues_map_delta', {
    p_since: since ?? undefined,
    p_city: city ?? undefined,
    p_type: type ?? undefined,
    p_city_id: cityId ?? undefined,
  });
  return { data: (data as VenuesDeltaResponse | null) ?? null, error };
}
