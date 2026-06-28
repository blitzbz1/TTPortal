import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PersistedCity } from '../lib/citiesPersistentCache';

export interface CitiesDeltaResponse {
  upserts: PersistedCity[];
  tombstone_ids: number[];
  synced_at: string;
}

/**
 * Reverted to the PROD-deployed get_cities_delta. The tiered get_cities_catalog_v2
 * (Stage 2, migration 139) is NOT on prod, so calling it 404s → cities fail to
 * load (empty switcher, city falls back to București). Stage 2 tiering is also
 * MEASURED MOOT (prod tier ≈ the whole catalog, research §8), so there is little
 * reason to deploy 139. If it is ever deployed, switch this back to
 * 'get_cities_catalog_v2' and bump CITIES_CACHE_SCHEMA_VERSION. The Stage-2 client
 * code (search/fallback/search_key) stays in the repo but is dormant on the full
 * catalog.
 */
export async function getCitiesDelta(
  since: string | null,
): Promise<{ data: CitiesDeltaResponse | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.rpc('get_cities_delta', { p_since: since ?? undefined });
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
