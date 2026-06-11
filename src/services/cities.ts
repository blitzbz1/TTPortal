import { supabase } from '../lib/supabase';
import { canonicalizeCityName } from '../lib/cityCatalog';
import { FALLBACK_COUNTRY_CODE, getCountryByCode } from '../lib/locationHelpers';
import { clearCitiesCache } from '../lib/citiesPersistentCache';

// The "list cities" path is intentionally not in this file anymore —
// callers should use useCitiesQuery (delta-synced via citiesDelta +
// citiesPersistentCache). That cache only ever ships rows added/changed/
// removed since the device's last sync, which beats any TTL strategy at
// this granularity.

/**
 * Ensures a city (and its country) exists in the catalog and returns its id.
 *
 * Backed by the find_or_create_city SECURITY DEFINER RPC (migration 088),
 * which normalizes, validates, dedupes diacritic/case variants, and repairs
 * stale rows server-side — direct INSERTs into cities/countries are
 * admin-only now.
 */
interface UpsertCityOptions {
  countryCode?: string | null;
  countryName?: string | null;
  lat?: number | null;
  lng?: number | null;
  zoom?: number | null;
}

function isFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function upsertCity(
  name: string,
  countryCodeOrOptions: string | null | undefined | UpsertCityOptions = FALLBACK_COUNTRY_CODE,
): Promise<{ id: number | null; error: string | null }> {
  const canonicalName = canonicalizeCityName(name);
  const options = countryCodeOrOptions && typeof countryCodeOrOptions === 'object'
    ? countryCodeOrOptions
    : { countryCode: countryCodeOrOptions };
  const countryCode = (options.countryCode ?? FALLBACK_COUNTRY_CODE).toUpperCase();
  const country = getCountryByCode(countryCode);
  const countryName = options.countryName ?? country.name;
  const hasMapCenter = isFiniteCoordinate(options.lat) && isFiniteCoordinate(options.lng);

  const { data, error } = await supabase.rpc('find_or_create_city', {
    p_name: canonicalName,
    p_country_code: country.code,
    p_country_name: countryName,
    p_lat: hasMapCenter ? options.lat ?? undefined : undefined,
    p_lng: hasMapCenter ? options.lng ?? undefined : undefined,
    p_zoom: hasMapCenter ? options.zoom ?? 12 : undefined,
  });

  if (error) return { id: null, error: error.message };
  if (typeof data !== 'number') return { id: null, error: 'city_upsert_failed' };

  clearCitiesCache();
  return { id: data, error: null };
}
