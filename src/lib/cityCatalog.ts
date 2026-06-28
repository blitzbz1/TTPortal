import type { PersistedCity } from './citiesPersistentCache';
import { compareRo } from './collation';

export const PIATRA_NEAMT_CANONICAL_NAME = 'Piatra Neamț';

// cityKey runs NFD normalization + two regex passes. cleanCityCatalog calls it
// ~2\u00d7 per row (hidden check + Piatra check) over ~10k rows, on every pipeline
// run, so cache by raw name (a bounded set \u2014 the catalog's distinct names).
// Output is byte-identical; mirrors normalizeCityName's cache in locationHelpers.
const cityKeyCache = new Map<string, string>();
function cityKey(name: string): string {
  const cached = cityKeyCache.get(name);
  if (cached !== undefined) return cached;
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  cityKeyCache.set(name, key);
  return key;
}

const HIDDEN_CITY_KEYS = new Set(['carcea', 'circea']);
const PIATRA_NEAMT_KEY = cityKey(PIATRA_NEAMT_CANONICAL_NAME);

export function shouldHideCityName(name: string): boolean {
  return HIDDEN_CITY_KEYS.has(cityKey(name));
}

export function canonicalizeCityName(name: string): string {
  const trimmed = name.trim();
  if (cityKey(trimmed) === PIATRA_NEAMT_KEY) return PIATRA_NEAMT_CANONICAL_NAME;
  return trimmed;
}

export function cleanCityCatalog(cities: PersistedCity[]): PersistedCity[] {
  const visible: PersistedCity[] = [];
  let piatraNeamt: PersistedCity | null = null;
  let piatraNeamtVenueCount = 0;

  for (const city of cities) {
    if (shouldHideCityName(city.name)) continue;

    if (cityKey(city.name) === PIATRA_NEAMT_KEY) {
      piatraNeamtVenueCount += city.venue_count ?? 0;
      if (!piatraNeamt || city.name === PIATRA_NEAMT_CANONICAL_NAME) {
        piatraNeamt = city;
      }
      continue;
    }

    visible.push(city);
  }

  if (piatraNeamt) {
    visible.push({
      ...piatraNeamt,
      name: PIATRA_NEAMT_CANONICAL_NAME,
      county: piatraNeamt.county ?? 'Neamț',
      venue_count: piatraNeamtVenueCount,
      active: true,
    });
  }

  return visible.sort((a, b) => compareRo(a.name, b.name));
}
