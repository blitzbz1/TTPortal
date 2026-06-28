import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PersistedCity } from '../lib/citiesPersistentCache';

export interface CitiesDeltaResponse {
  upserts: PersistedCity[];
  tombstone_ids: number[];
  synced_at: string;
}

/**
 * Stage 2: the eager cities delta now ships ONLY the venue-bearing / eager tier
 * via get_cities_catalog_v2 (was the full ~10,330-row get_cities_delta). Same
 * {upserts, tombstone_ids, synced_at} envelope — the client merge/cache logic is
 * unchanged; only the row population shrinks to the tier (plus a fell-out-of-tier
 * tombstone branch). get_cities_delta stays server-side for pre-138 clients.
 */
export async function getCitiesDelta(
  since: string | null,
): Promise<{ data: CitiesDeltaResponse | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.rpc('get_cities_catalog_v2', { p_since: since ?? undefined });
  return { data: (data as CitiesDeltaResponse | null) ?? null, error };
}

/**
 * Stage 2: on-demand long-tail prefix search over the FULL catalog (not just the
 * tier), so a zero-venue city outside the eager set is still selectable. Returns
 * the same tier-row projection as the delta upserts, so callers reuse
 * toLocationCity + the catalog merge helpers.
 */
export async function searchCities(
  query: string,
  limit: number = 20,
): Promise<{ data: PersistedCity[]; error: PostgrestError | null }> {
  const { data, error } = await supabase.rpc('search_cities', { p_query: query, p_limit: limit });
  return { data: (data as PersistedCity[] | null) ?? [], error };
}

/**
 * Stage 2: single-row fallback for a saved selectedCity whose id is no longer in
 * the eager tier (LocationProvider boot resolution). Positive ids only — negative
 * EXPANSION_CITY_WAVE client ids resolve entirely client-side, so they are
 * filtered out before the call (an all-negative/empty list skips the round-trip).
 */
export async function getCitiesByIds(
  ids: number[],
): Promise<{ data: PersistedCity[]; error: PostgrestError | null }> {
  const positiveIds = ids.filter((id) => id > 0);
  if (positiveIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.rpc('get_cities_by_ids', { p_ids: positiveIds });
  return { data: (data as PersistedCity[] | null) ?? [], error };
}
