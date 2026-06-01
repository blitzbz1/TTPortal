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
 * Ensures a city exists in the cities table and returns its id.
 * If the city already exists (matched by name), returns the existing row.
 * Otherwise inserts a new row with the given name.
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

function hasMeaningfullyDifferentCoordinate(current: number | null | undefined, next: number): boolean {
  return !isFiniteCoordinate(current) || Math.abs(current - next) > 0.000001;
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

  const { data: existingCountry, error: countrySelectError } = await supabase
    .from('countries')
    .select('code')
    .eq('code', country.code)
    .maybeSingle();

  if (countrySelectError) return { id: null, error: countrySelectError.message };

  if (!existingCountry) {
    const { error: countryInsertError } = await supabase
      .from('countries')
      .insert({
        code: country.code,
        name: countryName,
        active: true,
      });

    if (countryInsertError && countryInsertError.code !== '23505') {
      return { id: null, error: countryInsertError.message };
    }
  }

  const { data: existing, error: selectError } = await supabase
    .from('cities')
    .select('id, country_name, lat, lng, zoom, active, expansion_status')
    .eq('name', canonicalName)
    .eq('country_code', country.code)
    .maybeSingle();

  if (selectError) return { id: null, error: selectError.message };
  if (existing?.id) {
    const repair: Record<string, unknown> = {};
    if (countryName && existing.country_name !== countryName) repair.country_name = countryName;
    if (hasMapCenter && hasMeaningfullyDifferentCoordinate(existing.lat, options.lat!)) repair.lat = options.lat;
    if (hasMapCenter && hasMeaningfullyDifferentCoordinate(existing.lng, options.lng!)) repair.lng = options.lng;
    if (hasMapCenter && (existing.zoom == null || existing.zoom !== (options.zoom ?? 12))) repair.zoom = options.zoom ?? 12;
    if (existing.active !== true) repair.active = true;
    if (existing.expansion_status == null || existing.expansion_status === 'hidden') repair.expansion_status = 'active';

    if (Object.keys(repair).length > 0) {
      const { error: updateError } = await supabase
        .from('cities')
        .update(repair)
        .eq('id', existing.id);
      if (updateError) return { id: null, error: updateError.message };
      clearCitiesCache();
    }

    return { id: existing.id, error: null };
  }
  if (!hasMapCenter) {
    return { id: null, error: 'city_map_center_required' };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('cities')
    .insert({
      name: canonicalName,
      country_code: country.code,
      country_name: countryName,
      ...(hasMapCenter ? { lat: options.lat, lng: options.lng, zoom: options.zoom ?? 12 } : {}),
      active: true,
      expansion_status: 'active',
    })
    .select('id')
    .single();

  if (!insertError) {
    clearCitiesCache();
    return { id: inserted.id, error: null };
  }

  // If another browser created the city between our SELECT and INSERT, recover
  // by reading the existing row instead of surfacing the unique violation.
  if (insertError.code === '23505') {
    const { data: raced, error: raceSelectError } = await supabase
      .from('cities')
      .select('id')
      .eq('name', canonicalName)
      .eq('country_code', country.code)
      .maybeSingle();

    if (raceSelectError) return { id: null, error: raceSelectError.message };
    if (raced?.id) {
      clearCitiesCache();
      return { id: raced.id, error: null };
    }
  }

  return { id: null, error: insertError.message };
}
