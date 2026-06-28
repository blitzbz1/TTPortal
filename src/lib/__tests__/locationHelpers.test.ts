import {
  getRecommendedCities,
  isCapitalCity,
  RECOMMENDED_CITY_LIMIT,
  mergeExpansionCityWave,
  mergeSearchedCities,
  EXPANSION_CITY_WAVE,
} from '../locationHelpers';
import type { LocationCity } from '../locationTypes';

function city(id: number, name: string, country_code: string, venue_count: number): LocationCity {
  return {
    id,
    name,
    county: null,
    country_code,
    country_name: country_code,
    admin_area: null,
    local_area: null,
    lat: 0,
    lng: 0,
    zoom: 12,
    venue_count,
    active: true,
    expansion_status: 'active',
    updated_at: '2026-06-06T00:00:00.000Z',
  };
}

describe('isCapitalCity', () => {
  it('matches a capital by its endonym', () => {
    expect(isCapitalCity(city(1, 'Paris', 'FR', 0))).toBe(true);
    expect(isCapitalCity(city(2, 'Wien', 'AT', 0))).toBe(true);
  });

  it('is diacritic/case-insensitive (stored ASCII still matches)', () => {
    // DB stores Moldova's capital as ASCII "Chisinau"; the map uses "Chișinău".
    expect(isCapitalCity(city(3, 'Chisinau', 'MD', 0))).toBe(true);
  });

  it('rejects non-capitals and unknown countries', () => {
    expect(isCapitalCity(city(4, 'Lyon', 'FR', 99))).toBe(false);
    expect(isCapitalCity(city(5, 'Atlantis', 'XX', 99))).toBe(false);
  });
});

describe('getRecommendedCities', () => {
  it('puts capitals first regardless of venue count, then busiest others', () => {
    const cities = [
      city(1, 'Lyon', 'FR', 500), // busy non-capital
      city(2, 'Paris', 'FR', 0), // capital, no venues
      city(3, 'Hamburg', 'DE', 800), // busy non-capital
      city(4, 'Berlin', 'DE', 100), // capital
    ];
    expect(getRecommendedCities(cities).map((c) => c.name)).toEqual([
      'Berlin', // capital, 100 venues -> capitals sorted by venues desc
      'Paris', // capital, 0 venues
      'Hamburg', // busiest non-capital
      'Lyon',
    ]);
  });

  it('caps the list at the recommended limit', () => {
    const many = Array.from({ length: RECOMMENDED_CITY_LIMIT + 5 }, (_, i) =>
      city(i + 1, `City ${i + 1}`, 'DE', 100 - i),
    );
    expect(getRecommendedCities(many)).toHaveLength(RECOMMENDED_CITY_LIMIT);
  });
});

describe('mergeExpansionCityWave (Stage 2 — wave survives the tier shrink)', () => {
  it('keeps Vienna reachable via the wave when the tier omits it', () => {
    // A tier with zero Austrian cities still surfaces the -1001 wave Vienna.
    const tier = [city(7, 'Cluj', 'RO', 3)];
    const names = mergeExpansionCityWave(tier).map((c) => c.name);
    expect(names).toContain('Vienna');
    expect(names).toContain('Cluj');
  });

  // Perf guardrail: the wave-merge sort dropped its per-comparison ICU
  // compareDefault(country_code) for a plain ASCII compare (cold-mount
  // materialize). Lock that the cross-country order is still code-ascending and
  // names stay compareRo-sorted within a country, so the optimization can't
  // silently reorder the switcher.
  it('orders by country code (plain ASCII == default collation) then name', () => {
    const input = [
      city(1, 'Zwickau', 'DE', 1),
      city(2, 'Aachen', 'DE', 1),
      city(3, 'Arad', 'RO', 1),
      city(4, 'Graz', 'AT', 1),
    ];
    // AT < DE < RO (uppercase ASCII), and DE's Aachen before Zwolle.
    const order = mergeExpansionCityWave(input)
      .filter((c) => c.id > 0)
      .map((c) => `${c.country_code}:${c.name}`);
    expect(order).toEqual(['AT:Graz', 'DE:Aachen', 'DE:Zwickau', 'RO:Arad']);
  });
});

describe('mergeSearchedCities (T050 — fold long-tail results into activeCities)', () => {
  it('returns the base array identity when there is nothing to merge', () => {
    const base = [city(1, 'Cluj', 'RO', 3)];
    expect(mergeSearchedCities(base, [])).toBe(base);
  });

  it('adds a searched long-tail city, deduped + sorted into the set', () => {
    const base = mergeExpansionCityWave([city(1, 'Cluj', 'RO', 3)]);
    const searched = [city(900, 'Buftea', 'RO', 0)]; // zero-venue long-tail, not in tier
    const merged = mergeSearchedCities(base, searched);
    expect(merged.find((c) => c.id === 900)?.name).toBe('Buftea');
    // RO group stays name-sorted: Buftea before Cluj.
    const ro = merged.filter((c) => c.country_code === 'RO').map((c) => c.name);
    expect(ro.indexOf('Buftea')).toBeLessThan(ro.indexOf('Cluj'));
  });

  it('lets a real searched row override a placeholder wave entry (same country:name)', () => {
    const wave = EXPANSION_CITY_WAVE.find((c) => c.name === 'Vienna')!;
    const base = mergeExpansionCityWave([]); // contains the -1001 placeholder Vienna
    const realVienna: LocationCity = { ...wave, id: 555, venue_count: 12 };
    const merged = mergeSearchedCities(base, [realVienna]);
    const viennas = merged.filter((c) => c.name === 'Vienna');
    expect(viennas).toHaveLength(1); // no duplicate
    expect(viennas[0].id).toBe(555); // the real row won
  });
});
