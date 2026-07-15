import {
  PIATRA_NEAMT_CANONICAL_NAME,
  canonicalizeCityName,
  cleanCityCatalog,
  shouldHideCityName,
} from '../cityCatalog';
import type { PersistedCity } from '../citiesPersistentCache';

function city(overrides: Partial<PersistedCity>): PersistedCity {
  return {
    id: 1,
    name: 'București',
    county: null,
    lat: null,
    lng: null,
    zoom: null,
    venue_count: 0,
    active: true,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('cityCatalog', () => {
  it('canonicalizes Piatra Neamt variants to the no-hyphen Romanian spelling', () => {
    expect(canonicalizeCityName('Piatra-Neamt')).toBe(PIATRA_NEAMT_CANONICAL_NAME);
    expect(canonicalizeCityName('Piatra-Neamț')).toBe(PIATRA_NEAMT_CANONICAL_NAME);
    expect(canonicalizeCityName(' Piatra Neamt ')).toBe(PIATRA_NEAMT_CANONICAL_NAME);
  });

  it('hides Carcea variants from city selection', () => {
    expect(shouldHideCityName('Carcea')).toBe(true);
    expect(shouldHideCityName('Cârcea')).toBe(true);
    expect(shouldHideCityName('București')).toBe(false);
  });

  it('merges Piatra Neamt variants and removes hidden cities from cached catalogs', () => {
    const cleaned = cleanCityCatalog([
      city({ id: 1, name: 'Piatra Neamt', venue_count: 4 }),
      city({ id: 2, name: 'Piatra-Neamt', venue_count: 1 }),
      city({ id: 3, name: 'Carcea', venue_count: 1 }),
      city({ id: 4, name: 'București', venue_count: 2 }),
    ]);

    expect(cleaned.map((c) => c.name)).toEqual(['București', PIATRA_NEAMT_CANONICAL_NAME]);
    expect(cleaned.find((c) => c.name === PIATRA_NEAMT_CANONICAL_NAME)?.venue_count).toBe(5);
  });
});
