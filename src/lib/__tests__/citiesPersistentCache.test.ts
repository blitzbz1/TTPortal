// Stage 1 (T020, T022) — the cities cache's parse-avoidance + memoization.
// Stage 2 (T046) — the tier reshape (search_key + the CITIES version bump).
import { createMMKV } from 'react-native-mmkv';
import {
  readCities,
  writeCities,
  getCleanedCities,
  applyCitiesDelta,
  clearCitiesCache,
  type CitiesCache,
  type PersistedCity,
} from '../citiesPersistentCache';
import { CITIES_CACHE_SCHEMA_VERSION } from '../cacheSchema';
import * as cityCatalog from '../cityCatalog';

// launchTrace (pulled in by readCities) writes a timeline file via the legacy FS.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

const store = createMMKV({ id: 'cities-cache-v2' });

function city(id: number, name: string): PersistedCity {
  return { id, name, county: null, lat: 1, lng: 2, zoom: 10, venue_count: 1, active: true, updated_at: 't' };
}

const CACHE: CitiesCache = {
  cities: [city(2, 'Brno'), city(1, 'Praha')],
  syncedAt: '2026-06-01T00:00:00Z',
};

/** JSON.parse calls whose argument is the current cities blob (ignores noise). */
function citiesParseCount(spy: jest.SpyInstance): number {
  const raw = store.getString('cities');
  return spy.mock.calls.filter((c) => c[0] === raw).length;
}

beforeEach(() => {
  clearCitiesCache(); // resets the MMKV store AND the parse/clean memos
});

describe('citiesPersistentCache (Stage 1)', () => {
  describe('T020 — applyCitiesDelta base param', () => {
    it('does not parse the cache when a base is supplied', () => {
      writeCities(CACHE);
      const base = readCities(); // the one parse to obtain the base
      const parseSpy = jest.spyOn(JSON, 'parse'); // installed AFTER that parse
      applyCitiesDelta([], [], 't2', base);
      expect(citiesParseCount(parseSpy)).toBe(0);
      parseSpy.mockRestore();
    });

    it('merges identically with or without a base (param is parse-avoidance only)', () => {
      const upsert = city(3, 'Cluj');
      writeCities(CACHE);
      const withBase = applyCitiesDelta([upsert], [], 't2', readCities());
      writeCities(CACHE); // reset to the same starting state
      const withoutBase = applyCitiesDelta([upsert], [], 't2');
      expect(withBase.cities).toEqual(withoutBase.cities);
      expect(withBase.cities.map((c) => c.name)).toEqual(['Brno', 'Cluj', 'Praha']);
    });
  });

  describe('T022 — parse + clean memoization', () => {
    it('parses the stored blob at most once across repeated readCities', () => {
      writeCities(CACHE);
      const parseSpy = jest.spyOn(JSON, 'parse');
      readCities();
      readCities();
      readCities();
      expect(citiesParseCount(parseSpy)).toBe(1);
      parseSpy.mockRestore();
    });

    it('returns a referentially identical cleaned array on repeated getCleanedCities (memo hit)', () => {
      writeCities(CACHE);
      expect(getCleanedCities()).toBe(getCleanedCities());
    });

    it('runs cleanCityCatalog once per parsed cache despite many getCleanedCities calls', () => {
      writeCities(CACHE);
      const cleanSpy = jest.spyOn(cityCatalog, 'cleanCityCatalog');
      getCleanedCities();
      getCleanedCities();
      getCleanedCities();
      expect(cleanSpy).toHaveBeenCalledTimes(1);
      cleanSpy.mockRestore();
    });

    it('re-parses and re-cleans after writeCities invalidates the memo', () => {
      writeCities(CACHE);
      const before = getCleanedCities();
      const parseSpy = jest.spyOn(JSON, 'parse');
      writeCities({ cities: [city(9, 'Iași')], syncedAt: 't9' });
      const after = getCleanedCities();
      expect(after).not.toBe(before);
      expect(after?.map((c) => c.id)).toEqual([9]);
      expect(citiesParseCount(parseSpy)).toBe(1); // re-parsed the new blob once
      parseSpy.mockRestore();
    });
  });

  describe('T046 — tier reshape (search_key + version bump)', () => {
    it('round-trips the server-built search_key on a tier row', () => {
      const tierCity: PersistedCity = { ...city(7, 'Cluj-Napoca'), search_key: 'clujnapoca cluj romania' };
      writeCities({ cities: [tierCity], syncedAt: 't' });
      expect(readCities()?.cities[0].search_key).toBe('clujnapoca cluj romania');
    });

    it('treats a payload at the PREVIOUS cities version as a miss (forces since=null re-pull)', () => {
      // A full-catalog v:(N-1) envelope written before the Stage-2 reshape.
      store.set('cities', JSON.stringify({ v: CITIES_CACHE_SCHEMA_VERSION - 1, cities: [city(1, 'Praha')], syncedAt: 's' }));
      expect(readCities()).toBeNull();
    });

    it('removes a fell-out-of-tier id via the tombstone branch (merge unchanged on the tier shape)', () => {
      writeCities({ cities: [city(1, 'Praha'), city(2, 'Brno')], syncedAt: 't0' });
      const next = applyCitiesDelta([], [2], 't1', readCities());
      expect(next.cities.map((c) => c.id)).toEqual([1]); // Brno fell out of the tier
    });
  });
});
