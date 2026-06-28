import { createMMKV } from 'react-native-mmkv';
import {
  CITIES_CACHE_SCHEMA_VERSION,
  VENUES_CACHE_SCHEMA_VERSION,
  KV_CACHE_SCHEMA_VERSION,
} from '../cacheSchema';
import {
  readVenueScope,
  writeVenueScope,
  clearVenuesCache,
  type VenueScopeCache,
} from '../venuesPersistentCache';
import { readCities, writeCities, clearCitiesCache } from '../citiesPersistentCache';

const venuesStore = createMMKV({ id: 'venues-cache-v2' });
const citiesStore = createMMKV({ id: 'cities-cache-v2' });

const SCOPE: VenueScopeCache = {
  venues: [{ id: 1, name: 'V', type: 'parc_exterior', address: 'A', lat: 1, lng: 2, tables_count: null, condition: null, free_access: null, night_lighting: null, nets: null, verified: null }],
  syncedAt: '2026-06-01T00:00:00Z',
};

beforeEach(() => {
  clearVenuesCache();
  clearCitiesCache();
});

describe('cache schema versioning (T034)', () => {
  it('exposes three independent per-domain schema versions (T010)', () => {
    // VENUES = 2: mig 138 (get_venues_map_delta) is deployed to prod. CITIES = 1:
    // mig 139 (get_cities_catalog_v2) is NOT deployed (tiering is moot). A version
    // must only lead its RPC's deploy. See cacheSchema.ts.
    expect(CITIES_CACHE_SCHEMA_VERSION).toBe(1);
    expect(VENUES_CACHE_SCHEMA_VERSION).toBe(2);
    expect(KV_CACHE_SCHEMA_VERSION).toBe(1);
  });

  it('round-trips venue scopes written at the current version', () => {
    writeVenueScope('X', null, SCOPE);
    const read = readVenueScope('X', null);
    expect(read?.venues).toHaveLength(1);
    expect(read?.v).toBe(VENUES_CACHE_SCHEMA_VERSION);
    expect(read?.syncedAt).toBe(SCOPE.syncedAt);
  });

  it('treats pre-versioning venue envelopes (no v) as a miss', () => {
    venuesStore.set('scope:X:all', JSON.stringify(SCOPE)); // legacy shape, no v
    expect(readVenueScope('X', null)).toBeNull();
  });

  it('treats version-mismatched venue envelopes as a miss', () => {
    venuesStore.set('scope:X:all', JSON.stringify({ ...SCOPE, v: VENUES_CACHE_SCHEMA_VERSION + 1 }));
    expect(readVenueScope('X', null)).toBeNull();
  });

  it('round-trips cities written at the current version and misses on legacy envelopes', () => {
    citiesStore.set('cities', JSON.stringify({ cities: [], syncedAt: 's' })); // legacy
    expect(readCities()).toBeNull();

    writeCities({ cities: [], syncedAt: '2026-06-01T00:00:00Z' });
    expect(readCities()?.v).toBe(CITIES_CACHE_SCHEMA_VERSION);
  });
});
