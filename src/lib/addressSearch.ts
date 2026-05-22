export interface AddressSearchCityRecord {
  name: string;
  country_code?: string | null;
  country_name?: string | null;
  admin_area?: string | null;
  lat?: number | null;
  lng?: number | null;
  zoom?: number | null;
}

export interface AddressSearchContext {
  city: string;
  countryCode?: string | null;
  countryName?: string | null;
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
  cityZoom?: number | null;
  knownCityRecords?: AddressSearchCityRecord[];
}

export interface AddressSearchRequest {
  url: string;
  kind: 'structured' | 'freeform' | 'fallback';
  weight: number;
}

export interface AddressSuggestionLike {
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  addresstype?: string;
  importance?: number;
  place_rank?: number;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
  };
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

export function normalizeAddressQuery(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function findCityRecord(
  city: string,
  knownCityRecords: AddressSearchCityRecord[] = [],
): AddressSearchCityRecord | null {
  const normalizedCity = normalizeAddressQuery(city.trim());
  if (!normalizedCity) return null;
  const matches = knownCityRecords.filter((record) => normalizeAddressQuery(record.name) === normalizedCity);
  return matches.length === 1 ? matches[0] : null;
}

export function buildAddressFreeformQuery(text: string, city: string): string {
  const trimmed = text.trim();
  const trimmedCity = city.trim();
  if (!trimmedCity || normalizeAddressQuery(trimmed).includes(normalizeAddressQuery(trimmedCity))) {
    return trimmed;
  }
  return `${trimmed}, ${trimmedCity}`;
}

export function resolveAddressSearchContext({
  city,
  countryCode,
  countryName,
  cityCenterLat,
  cityCenterLng,
  cityZoom,
  knownCityRecords = [],
}: AddressSearchContext): Required<Pick<AddressSearchContext, 'city'>> & {
  countryCode: string | null;
  countryName: string | null;
  cityCenterLat: number | null;
  cityCenterLng: number | null;
  cityZoom: number | null;
} {
  const record = findCityRecord(city, knownCityRecords);
  return {
    city: city.trim(),
    countryCode: countryCode?.toUpperCase() ?? record?.country_code?.toUpperCase() ?? null,
    countryName: countryName ?? record?.country_name ?? null,
    cityCenterLat: cityCenterLat ?? record?.lat ?? null,
    cityCenterLng: cityCenterLng ?? record?.lng ?? null,
    cityZoom: cityZoom ?? record?.zoom ?? null,
  };
}

function buildSearchUrl(params: Record<string, string>): string {
  const searchParams = new URLSearchParams({
    format: 'json',
    dedupe: '1',
    addressdetails: '1',
    ...params,
  });
  return `${NOMINATIM_SEARCH_URL}?${searchParams.toString()}`;
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    const key = normalizeAddressQuery(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}

export function buildStreetQueryVariants(text: string, countryCode?: string | null): string[] {
  const trimmed = text.trim();
  const normalized = normalizeAddressQuery(trimmed);
  const country = countryCode?.toUpperCase() ?? null;
  const variants = [trimmed];
  const rest = (pattern: RegExp) => trimmed.replace(pattern, '').trim();

  if (country === 'DE' || country === 'AT' || country === 'CH') {
    if (trimmed.includes('ß')) variants.push(trimmed.replace(/ß/g, 'ss'));
    if (/strasse\b/i.test(trimmed)) variants.push(trimmed.replace(/strasse\b/gi, 'straße'));
    if (/^str\.?\s+/i.test(trimmed)) variants.push(`Straße ${rest(/^str\.?\s+/i)}`);
  }

  if (country === 'ES') {
    if (/^(av|av\.|ave|avenida|avinguda)\s+/i.test(trimmed)) {
      const suffix = rest(/^(av|av\.|ave|avenida|avinguda)\s+/i);
      variants.push(`Avenida ${suffix}`, `Avinguda ${suffix}`);
    }
    if (/^(c|c\.|calle|carrer)\s+/i.test(trimmed)) {
      const suffix = rest(/^(c|c\.|calle|carrer)\s+/i);
      variants.push(`Calle ${suffix}`, `Carrer ${suffix}`);
    }
  }

  if (country === 'FR' || country === 'BE') {
    if (/^(r|r\.|rue)\s+/i.test(trimmed)) variants.push(`Rue ${rest(/^(r|r\.|rue)\s+/i)}`);
    if (/^(av|av\.|avenue)\s+/i.test(trimmed)) variants.push(`Avenue ${rest(/^(av|av\.|avenue)\s+/i)}`);
  }

  if (/^(st|st\.|str|str\.|street)\s+/i.test(trimmed) && !normalized.startsWith('strasse ')) {
    const suffix = rest(/^(st|st\.|str|str\.|street)\s+/i);
    variants.push(`Street ${suffix}`, `Strada ${suffix}`);
  }
  if (/^(bd|bd\.|bvd|bvd\.|blvd|blvd\.|boulevard|bulevardul)\s+/i.test(trimmed)) {
    const suffix = rest(/^(bd|bd\.|bvd|bvd\.|blvd|blvd\.|boulevard|bulevardul)\s+/i);
    variants.push(`Boulevard ${suffix}`, `Bulevardul ${suffix}`);
  }

  return uniqueValues(variants).slice(0, 4);
}

function buildCityViewbox(lat: number | null, lng: number | null, zoom: number | null): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const span = Math.max(0.08, Math.min(0.7, zoom && zoom >= 13 ? 0.12 : zoom && zoom <= 10 ? 0.55 : 0.28));
  const lngSpan = span / Math.max(0.35, Math.cos((Math.PI / 180) * lat));
  return [
    (lng - lngSpan).toFixed(6),
    (lat - span).toFixed(6),
    (lng + lngSpan).toFixed(6),
    (lat + span).toFixed(6),
  ].join(',');
}

export function buildAddressSearchRequests(
  text: string,
  context: AddressSearchContext,
  limit = 5,
): AddressSearchRequest[] {
  const street = text.trim();
  const resolved = resolveAddressSearchContext(context);
  const countrycodes = resolved.countryCode ? resolved.countryCode.toLowerCase() : null;
  const viewbox = buildCityViewbox(resolved.cityCenterLat, resolved.cityCenterLng, resolved.cityZoom);
  const cityParts = [resolved.city, resolved.countryName].filter(Boolean).join(', ');
  const streetVariants = buildStreetQueryVariants(street, resolved.countryCode);
  const requests: AddressSearchRequest[] = [];

  if (resolved.city) {
    for (const variant of streetVariants.slice(0, 3)) {
      requests.push({
        kind: 'structured',
        weight: variant === street ? 35 : 28,
        url: buildSearchUrl({
          limit: String(limit),
          street: variant,
          city: resolved.city,
          ...(countrycodes ? { countrycodes } : {}),
          ...(viewbox ? { viewbox } : {}),
        }),
      });
    }
  }

  requests.push({
    kind: 'freeform',
    weight: 18,
    url: buildSearchUrl({
      limit: String(limit),
      q: buildAddressFreeformQuery(street, resolved.city),
      ...(countrycodes ? { countrycodes } : {}),
      ...(viewbox ? { viewbox } : {}),
    }),
  });

  if (cityParts && cityParts !== resolved.city) {
    requests.push({
      kind: 'fallback',
      weight: 10,
      url: buildSearchUrl({
        limit: String(limit),
        q: `${street}, ${cityParts}`,
        ...(countrycodes ? { countrycodes } : {}),
        ...(viewbox ? { viewbox } : {}),
      }),
    });
  }

  return requests;
}

function suggestionCity(item: AddressSuggestionLike): string | null {
  return item.address?.city
    ?? item.address?.town
    ?? item.address?.village
    ?? item.address?.municipality
    ?? null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function scoreAddressSuggestion(
  item: AddressSuggestionLike,
  context: AddressSearchContext,
  requestWeight = 0,
): number {
  const resolved = resolveAddressSearchContext(context);
  const lat = Number.parseFloat(item.lat);
  const lng = Number.parseFloat(item.lon);
  const country = item.address?.country_code?.toUpperCase() ?? null;
  const cityName = suggestionCity(item);
  const klass = item.class?.toLowerCase();
  const type = item.type?.toLowerCase();
  const addresstype = item.addresstype?.toLowerCase();
  let score = requestWeight;

  if (resolved.countryCode && country === resolved.countryCode) score += 45;
  else if (resolved.countryCode && country && country !== resolved.countryCode) score -= 80;

  if (resolved.city && cityName && normalizeAddressQuery(cityName) === normalizeAddressQuery(resolved.city)) {
    score += 55;
  } else if (resolved.city && item.display_name && normalizeAddressQuery(item.display_name).includes(normalizeAddressQuery(resolved.city))) {
    score += 24;
  }

  if (item.address?.road || item.address?.pedestrian || item.address?.footway) score += 35;
  if (item.address?.house_number) score += 16;
  if (klass === 'highway' || addresstype === 'road') score += 24;
  if (klass === 'building' || addresstype === 'building' || type === 'house') score += 22;
  if (klass === 'amenity' || klass === 'shop' || klass === 'leisure') score += 10;
  if (type === 'city' || addresstype === 'city') score -= 30;
  if (typeof item.importance === 'number') score += item.importance * 15;
  if (typeof item.place_rank === 'number') score += Math.max(0, 30 - item.place_rank) * 0.5;

  if (
    Number.isFinite(lat)
    && Number.isFinite(lng)
    && resolved.cityCenterLat != null
    && resolved.cityCenterLng != null
  ) {
    const distance = haversineKm(resolved.cityCenterLat, resolved.cityCenterLng, lat, lng);
    score += Math.max(-40, 35 - distance);
  }

  return score;
}

export function mergeAndRankAddressSuggestions<T extends AddressSuggestionLike>(
  groups: Array<{ items: T[]; weight: number }>,
  context: AddressSearchContext,
  limit = 8,
): T[] {
  const byKey = new Map<string, { item: T; score: number }>();
  for (const group of groups) {
    for (const item of group.items) {
      const lat = Number.parseFloat(item.lat);
      const lon = Number.parseFloat(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const road = item.address?.road ?? item.address?.pedestrian ?? item.address?.footway ?? '';
      const key = [
        normalizeAddressQuery(road || item.display_name.split(',')[0] || ''),
        item.address?.house_number ?? '',
        item.address?.country_code ?? '',
        lat.toFixed(5),
        lon.toFixed(5),
      ].join(':');
      const score = scoreAddressSuggestion(item, context, group.weight);
      const existing = byKey.get(key);
      if (!existing || score > existing.score) byKey.set(key, { item, score });
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
