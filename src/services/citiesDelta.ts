import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PersistedCity } from '../lib/citiesPersistentCache';

export interface CitiesDeltaResponse {
  upserts: PersistedCity[];
  tombstone_ids: number[];
  synced_at: string;
}

export async function getCitiesDelta(
  since: string | null,
): Promise<{ data: CitiesDeltaResponse | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.rpc('get_cities_delta', { p_since: since ?? undefined });
  return { data: (data as CitiesDeltaResponse | null) ?? null, error };
}
