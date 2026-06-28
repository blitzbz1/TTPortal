// T013 (Stage 0) — guardrail: the three cache domains version INDEPENDENTLY.
// Bumping one domain's schema version must be invisible to the other two
// (research DO-NOT #1: a single shared constant would, on any one reshape,
// clearAll the offline-KV store + force a 3.35 MB cities re-parse + an
// every-scope venue re-pull). This spec must go red if the per-domain
// constants are ever collapsed back into one.
//
// Mechanism: seed all three MMKV stores at their current versions, then
// re-import the cache modules under a cacheSchema mock that bumps ONLY one
// domain, and assert the other two domains are untouched. The jest MMKV mock
// shares its store map across jest.isolateModules (proven by offline-cache's
// "seeds the KV schema version row" test), so the seeded data is visible to
// the re-imported modules.

import { createMMKV } from 'react-native-mmkv';
import {
  CITIES_CACHE_SCHEMA_VERSION,
  VENUES_CACHE_SCHEMA_VERSION,
  KV_CACHE_SCHEMA_VERSION,
} from '../cacheSchema';

// citiesPersistentCache pulls in launchTrace (→ legacy FS) transitively; stub
// it so the cold-mount trace never touches a real device path.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

// Direct handles to the three independent MMKV stores (same ids the modules use).
const kvStore = createMMKV({ id: 'offline-kv-cache' });
const citiesStore = createMMKV({ id: 'cities-cache-v2' });
const venuesStore = createMMKV({ id: 'venues-cache-v2' });

const KV_DATA = { hello: 1 };
const VENUE = {
  id: 1, name: 'V', type: 'parc_exterior', city: 'X', city_id: 1, address: 'A',
  lat: 1, lng: 2, tables_count: null, condition: null, free_access: null,
  night_lighting: null, nets: null, verified: null, approved: true,
  updated_at: 't', created_at: 't',
};
const CITY = {
  id: 1, name: 'X', county: null, lat: 1, lng: 2, zoom: 10,
  venue_count: 1, active: true, updated_at: 't',
};

// Seed every domain at its CURRENT version (runs after the global MMKV reset
// in jest.setup.afterEnv, so the stores start empty each test).
function seedAllDomains(): void {
  kvStore.set('__schema_version__', String(KV_CACHE_SCHEMA_VERSION));
  kvStore.set('events:u1', JSON.stringify({ v: KV_DATA, t: Date.now() }));
  venuesStore.set('scope:X:all', JSON.stringify({ v: VENUES_CACHE_SCHEMA_VERSION, venues: [VENUE], syncedAt: 's' }));
  citiesStore.set('cities', JSON.stringify({ v: CITIES_CACHE_SCHEMA_VERSION, cities: [CITY], syncedAt: 's' }));
}

interface CacheModules {
  offline: typeof import('../offline-cache');
  cities: typeof import('../citiesPersistentCache');
  venues: typeof import('../venuesPersistentCache');
}

// Re-import the cache modules under a cacheSchema mock that sets the given
// per-domain versions, exercising each module's own version gate.
function underVersions(
  versions: {
    CITIES_CACHE_SCHEMA_VERSION: number;
    VENUES_CACHE_SCHEMA_VERSION: number;
    KV_CACHE_SCHEMA_VERSION: number;
  },
  fn: (mods: CacheModules) => void,
): void {
  jest.isolateModules(() => {
    jest.doMock('../cacheSchema', () => versions);
    try {
      fn({
        // offline-cache first: its ensureSchema IIFE fires on require.
        offline: require('../offline-cache'),
        cities: require('../citiesPersistentCache'),
        venues: require('../venuesPersistentCache'),
      });
    } finally {
      jest.dontMock('../cacheSchema');
    }
  });
}

// NOTE: deliberately NO jest.resetModules() between cases — it would swap the
// react-native-mmkv mock instance, so the top-level store handles and the
// re-imported modules would stop sharing state. isolateModules + the per-call
// jest.dontMock('../cacheSchema') already give each case a clean module graph.

describe('per-domain cache-schema isolation (T013)', () => {
  it('a CITIES bump is invisible to the offline-KV and venues stores', () => {
    seedAllDomains();
    underVersions(
      {
        CITIES_CACHE_SCHEMA_VERSION: CITIES_CACHE_SCHEMA_VERSION + 1,
        VENUES_CACHE_SCHEMA_VERSION,
        KV_CACHE_SCHEMA_VERSION,
      },
      ({ offline, venues }) => {
        // KV version unchanged → ensureSchema did NOT clearAll.
        expect(offline.getCacheItem('events:u1')).toEqual(KV_DATA);
        // Venues version unchanged → scope still hydrates (no re-pull).
        expect(venues.readVenueScope('X', null)?.venues).toHaveLength(1);
      },
    );
  });

  it('a KV bump wipes only the offline-KV store, leaving cities + venues intact', () => {
    seedAllDomains();
    underVersions(
      {
        CITIES_CACHE_SCHEMA_VERSION,
        VENUES_CACHE_SCHEMA_VERSION,
        KV_CACHE_SCHEMA_VERSION: KV_CACHE_SCHEMA_VERSION + 1,
      },
      ({ offline, cities, venues }) => {
        // ensureSchema saw a mismatch → clearAll fired on offline-kv-cache only.
        expect(offline.getCacheItem('events:u1')).toBeNull();
        // Cities + venues are separate MMKV stores — untouched.
        expect(cities.readCities()).not.toBeNull();
        expect(venues.readVenueScope('X', null)?.venues).toHaveLength(1);
      },
    );
  });

  it('a VENUES bump misses only the venue scope, leaving cities + offline-KV intact', () => {
    seedAllDomains();
    underVersions(
      {
        CITIES_CACHE_SCHEMA_VERSION,
        VENUES_CACHE_SCHEMA_VERSION: VENUES_CACHE_SCHEMA_VERSION + 1,
        KV_CACHE_SCHEMA_VERSION,
      },
      ({ offline, cities, venues }) => {
        expect(venues.readVenueScope('X', null)).toBeNull();
        expect(cities.readCities()).not.toBeNull();
        expect(offline.getCacheItem('events:u1')).toEqual(KV_DATA);
      },
    );
  });
});
