import type { PersistedCity } from './citiesPersistentCache';
import { compareDefault, compareEn, compareRo } from './collation';
import { getCanonicalCountryName } from './countryLabels';
import type { CityExpansionStatus, Country, CountryCode, LocationCity } from './locationTypes';

export const FALLBACK_COUNTRY_CODE: CountryCode = 'RO';
export const FALLBACK_CITY_NAME = 'București';
export const FALLBACK_MAP_REGION = {
  latitude: 44.4268,
  longitude: 26.1025,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export const COUNTRIES: Country[] = [
  { code: 'RO', name: 'Romania', active: true },
  { code: 'AT', name: 'Austria', active: true },
  { code: 'DE', name: 'Germany', active: true },
  { code: 'ES', name: 'Spain', active: true },
  { code: 'CZ', name: 'Czechia', active: true },
  { code: 'PL', name: 'Poland', active: true },
  { code: 'GB', name: 'United Kingdom', active: true },
  { code: 'FR', name: 'France', active: true },
  { code: 'IT', name: 'Italy', active: true },
];

// Temporary client-side launch scaffolding for cities whose Supabase rows may
// not exist yet in local/dev environments. Negative ids deliberately cannot
// collide with real Postgres ids; backend-facing queries must ignore them as
// stable city identifiers until the matching migration seed rows exist.
export const EXPANSION_CITY_WAVE: LocationCity[] = [
  {
    id: -1001,
    name: 'Vienna',
    county: null,
    country_code: 'AT',
    country_name: 'Austria',
    admin_area: 'Vienna',
    local_area: null,
    lat: 48.2082,
    lng: 16.3738,
    zoom: 12,
    venue_count: 0,
    active: true,
    expansion_status: 'community_review',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1002,
    name: 'Berlin',
    county: null,
    country_code: 'DE',
    country_name: 'Germany',
    admin_area: 'Berlin',
    local_area: null,
    lat: 52.52,
    lng: 13.405,
    zoom: 11,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1003,
    name: 'Barcelona',
    county: null,
    country_code: 'ES',
    country_name: 'Spain',
    admin_area: 'Catalonia',
    local_area: null,
    lat: 41.3874,
    lng: 2.1686,
    zoom: 12,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1004,
    name: 'Madrid',
    county: null,
    country_code: 'ES',
    country_name: 'Spain',
    admin_area: 'Community of Madrid',
    local_area: null,
    lat: 40.4168,
    lng: -3.7038,
    zoom: 11,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1005,
    name: 'Prague',
    county: null,
    country_code: 'CZ',
    country_name: 'Czechia',
    admin_area: 'Prague',
    local_area: null,
    lat: 50.0755,
    lng: 14.4378,
    zoom: 12,
    venue_count: 0,
    active: true,
    expansion_status: 'community_review',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1006,
    name: 'Warsaw',
    county: null,
    country_code: 'PL',
    country_name: 'Poland',
    admin_area: 'Masovian Voivodeship',
    local_area: null,
    lat: 52.2297,
    lng: 21.0122,
    zoom: 11,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1007,
    name: 'London',
    county: null,
    country_code: 'GB',
    country_name: 'United Kingdom',
    admin_area: 'England',
    local_area: null,
    lat: 51.5074,
    lng: -0.1278,
    zoom: 10,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1008,
    name: 'Paris',
    county: null,
    country_code: 'FR',
    country_name: 'France',
    admin_area: 'Ile-de-France',
    local_area: null,
    lat: 48.8566,
    lng: 2.3522,
    zoom: 11,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
  {
    id: -1009,
    name: 'Rome',
    county: null,
    country_code: 'IT',
    country_name: 'Italy',
    admin_area: 'Lazio',
    local_area: null,
    lat: 41.9028,
    lng: 12.4964,
    zoom: 11,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
];

// Shared catalog ordering: country_code, then city name (Romanian collation).
// Used by both the wave merge and the searched-city merge so a long-tail result
// slots into exactly the position the switcher already sorts by.
function compareCityByCountryThenName(a: LocationCity, b: LocationCity): number {
  // Perf (cold-mount materialize): country codes are 2-letter UPPERCASE ASCII, so
  // a plain comparison is byte-identical to the default ICU collation but skips an
  // Intl.Collator call on EVERY one of the ~133k comparisons in the ~10k-city
  // wave-merge sort. Name keeps compareRo so the visible Romanian-collated order
  // is unchanged.
  if (a.country_code !== b.country_code) return a.country_code < b.country_code ? -1 : 1;
  return compareRo(a.name, b.name);
}

export function mergeExpansionCityWave(cities: LocationCity[]): LocationCity[] {
  const byCountryAndName = new Map<string, LocationCity>();

  for (const city of EXPANSION_CITY_WAVE) {
    byCountryAndName.set(getCityKey(city), city);
  }
  for (const city of cities) {
    byCountryAndName.set(getCityKey(city), city);
  }

  return Array.from(byCountryAndName.values()).sort(compareCityByCountryThenName);
}

function getCityKey(city: Pick<LocationCity, 'country_code' | 'name'>): string {
  // Perf (cold-mount materialize): toLowerCase, NOT toLocaleLowerCase('ro').
  // Romanian has no special lowercasing rules (unlike Turkish's dotless i), so
  // the output is identical for Latin + Romanian text, but toLowerCase skips the
  // per-call ICU locale path — this runs ~10,339× building the wave-merge dedup
  // Map and was a large chunk of the measured ~1.9s materialize on Hermes.
  return `${city.country_code}:${city.name.toLowerCase()}`;
}

export function getCountryByCode(code?: string | null): Country {
  const existing = COUNTRIES.find((country) => country.code === code);
  if (existing) return existing;
  return code ? { code, name: getCanonicalCountryName(code, code), active: true } : COUNTRIES[0];
}

export function getCountryForCity(city: Pick<LocationCity, 'country_code' | 'country_name'>): Country {
  return {
    code: city.country_code,
    name: city.country_name || getCountryByCode(city.country_code).name,
    active: true,
  };
}

export function getCountriesFromCities(cities: LocationCity[]): Country[] {
  const byCode = new Map<string, Country>();
  for (const country of COUNTRIES) {
    if (country.active) byCode.set(country.code, country);
  }
  for (const city of cities) {
    if (city.expansion_status === 'hidden') continue;
    const existing = byCode.get(city.country_code);
    byCode.set(city.country_code, {
      code: city.country_code,
      name: getCanonicalCountryName(city.country_code, city.country_name || existing?.name || city.country_code),
      active: true,
    });
  }
  return Array.from(byCode.values()).sort((a, b) => compareEn(a.name, b.name));
}

export function getCountryFlagEmoji(code: string | null | undefined): string {
  const normalized = (code ?? '').toUpperCase();
  if (normalized === 'ALL') return '\u{1F1EA}\u{1F1FA}';
  if (!/^[A-Z]{2}$/.test(normalized)) return '\u{1F3D3}';
  const first = normalized.charCodeAt(0) - 65 + 0x1f1e6;
  const second = normalized.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
}

export function toLocationCity(city: PersistedCity): LocationCity {
  const countryCode = city.country_code ?? FALLBACK_COUNTRY_CODE;
  const countryName = city.country_name ?? getCountryByCode(countryCode).name;
  return {
    ...city,
    country_code: countryCode,
    country_name: countryName,
    admin_area: city.admin_area ?? city.county,
    local_area: city.local_area ?? null,
    expansion_status: normalizeExpansionStatus(city.expansion_status, city.active),
  };
}

function normalizeExpansionStatus(status: string | null | undefined, active: boolean | null): CityExpansionStatus {
  if (active === false) return 'hidden';
  if (
    status === 'active' ||
    status === 'launch_ready' ||
    status === 'community_review' ||
    status === 'researching' ||
    status === 'coming_soon' ||
    status === 'hidden'
  ) {
    return status;
  }
  return 'active';
}

export function getCityDisplayName(city: Pick<LocationCity, 'name'> | null | undefined): string {
  return city?.name ?? FALLBACK_CITY_NAME;
}

export function getCityAdminLabel(city: Pick<LocationCity, 'admin_area' | 'local_area'> | null | undefined): string | null {
  if (!city) return null;
  return [city.admin_area, city.local_area].filter(Boolean).join(' / ') || null;
}

export function getMapRegionForCity(city: LocationCity | null | undefined) {
  if (!city || city.lat == null || city.lng == null) return FALLBACK_MAP_REGION;
  const delta = city.zoom ? 360 / Math.pow(2, city.zoom) : FALLBACK_MAP_REGION.latitudeDelta;
  return {
    latitude: city.lat,
    longitude: city.lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

export function getDefaultCity(cities: LocationCity[]): LocationCity | null {
  return (
    cities.find((city) => city.name === FALLBACK_CITY_NAME && city.active !== false) ??
    cities.find((city) => city.active !== false) ??
    cities[0] ??
    null
  );
}

// How many cities the "Recommended cities" list surfaces (a short, scannable set).
export const RECOMMENDED_CITY_LIMIT = 10;

// National capital by country code, written as the endonym stored in the cities catalog
// (e.g. 'Wien', 'Praha', 'București'). Matched diacritic/case-insensitively, so a stored ASCII
// form like 'Chisinau' still resolves 'Chișinău'. Capitals with no imported venues are simply
// absent from the catalog and never match — the recommended list then falls back to busiest cities.
export const CAPITAL_BY_CC: Record<string, string> = {
  AL: 'Tirana', AM: 'Yerevan', AT: 'Wien', BA: 'Sarajevo', BE: 'Bruxelles', BG: 'Sofia',
  BY: 'Minsk', CH: 'Bern', CY: 'Nicosia', CZ: 'Praha', DE: 'Berlin', DK: 'København',
  DZ: 'Algiers', EE: 'Tallinn', ES: 'Madrid', FI: 'Helsinki', FR: 'Paris', GB: 'London',
  GE: 'Tbilisi', GR: 'Athens', HR: 'Zagreb', HU: 'Budapest', IE: 'Dublin', IR: 'Tehran',
  IS: 'Reykjavík', IT: 'Roma', LI: 'Vaduz', LT: 'Vilnius', LU: 'Luxembourg', LV: 'Riga',
  MC: 'Monaco', MD: 'Chișinău', ME: 'Podgorica', NL: 'Amsterdam', NO: 'Oslo', PL: 'Warszawa',
  PT: 'Lisboa', RO: 'București', RS: 'Beograd', RU: 'Moscow', SE: 'Stockholm', SI: 'Ljubljana',
  SK: 'Bratislava', TR: 'Ankara', UA: 'Kyiv',
};

// normalizeCityName runs NFD normalization + two regex passes per call. The
// catalog repeats the same ~10k city names across every getRecommendedCities
// run, so cache by raw name (a bounded set). Output is byte-identical.
const normalizedCityNameCache = new Map<string, string>();
const normalizeCityName = (value: string): string => {
  const cached = normalizedCityNameCache.get(value);
  if (cached !== undefined) return cached;
  const normalized = value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  normalizedCityNameCache.set(value, normalized);
  return normalized;
};

// Precompute the capital lookup once as `${country_code}:${normalizedCapital}`.
// isCapitalCity previously re-normalized both the city name AND the matching
// capital constant on every call — ~20k normalizations per ALL-countries
// getRecommendedCities run. This keeps the exact same match semantics
// (country-code-scoped, diacritic/case-insensitive) with one normalize per city.
const NORMALIZED_CAPITAL_KEYS = new Set<string>(
  Object.entries(CAPITAL_BY_CC).map(([cc, name]) => `${cc}:${normalizeCityName(name)}`),
);

export function isCapitalCity(city: Pick<LocationCity, 'name' | 'country_code'>): boolean {
  if (!city.country_code) return false;
  return NORMALIZED_CAPITAL_KEYS.has(`${city.country_code}:${normalizeCityName(city.name)}`);
}

// "Recommended cities": national capitals first (busiest first), then the busiest remaining
// cities, capped at `limit`. Deterministic (no per-user history) so the short list stays stable.
export function getRecommendedCities(
  cities: LocationCity[],
  limit: number = RECOMMENDED_CITY_LIMIT,
): LocationCity[] {
  const capitals: LocationCity[] = [];
  const rest: LocationCity[] = [];
  for (const city of cities) (isCapitalCity(city) ? capitals : rest).push(city);
  const byVenues = (a: LocationCity, b: LocationCity) =>
    (b.venue_count ?? 0) - (a.venue_count ?? 0) || compareDefault(a.name, b.name);
  capitals.sort(byVenues);
  rest.sort(byVenues);
  return [...capitals, ...rest].slice(0, limit);
}
