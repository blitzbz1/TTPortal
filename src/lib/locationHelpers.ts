import type { PersistedCity } from './citiesPersistentCache';
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

export function mergeExpansionCityWave(cities: LocationCity[]): LocationCity[] {
  const byCountryAndName = new Map<string, LocationCity>();

  for (const city of EXPANSION_CITY_WAVE) {
    byCountryAndName.set(getCityKey(city), city);
  }
  for (const city of cities) {
    byCountryAndName.set(getCityKey(city), city);
  }

  return Array.from(byCountryAndName.values()).sort((a, b) => {
    const country = a.country_code.localeCompare(b.country_code);
    return country === 0 ? a.name.localeCompare(b.name, 'ro') : country;
  });
}

function getCityKey(city: Pick<LocationCity, 'country_code' | 'name'>): string {
  return `${city.country_code}:${city.name.toLocaleLowerCase('ro')}`;
}

export function getCountryByCode(code?: string | null): Country {
  const existing = COUNTRIES.find((country) => country.code === code);
  if (existing) return existing;
  return code ? { code, name: code, active: true } : COUNTRIES[0];
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
      name: city.country_name || existing?.name || city.country_code,
      active: true,
    });
  }
  return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name, 'en'));
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
