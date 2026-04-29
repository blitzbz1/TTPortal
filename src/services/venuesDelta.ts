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
): Promise<{ data: VenuesDeltaResponse | null; error: any }> {
  const { data, error } = await supabase.rpc('get_venues_delta', {
    p_since: since,
    p_city: city ?? null,
    p_type: type ?? null,
  });
  return { data: (data as VenuesDeltaResponse | null) ?? null, error };
}
