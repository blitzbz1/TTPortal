import { getRecommendedCities, isCapitalCity, RECOMMENDED_CITY_LIMIT } from '../locationHelpers';
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
