// Stage 3 (T072) — the venues cache round-trips the slim 12-field row, treats a
// previous-version envelope as a miss (forces a since=null re-pull), and merges
// by id / removes tombstones with the slim shape.
import { createMMKV } from 'react-native-mmkv';
import { VENUES_CACHE_SCHEMA_VERSION } from '../cacheSchema';
import {
  readVenueScope,
  writeVenueScope,
  applyVenuesDelta,
  clearVenuesCache,
  type PersistedVenue,
  type VenueScopeCache,
} from '../venuesPersistentCache';

const store = createMMKV({ id: 'venues-cache-v2' });

function venue(id: number, name: string): PersistedVenue {
  return {
    id, name, type: 'parc_exterior', address: `Addr ${id}`, lat: 1, lng: 2,
    tables_count: 3, condition: 'buna', free_access: true, night_lighting: false,
    nets: true, verified: false,
  };
}

const SCOPE: VenueScopeCache = {
  venues: [venue(1, 'Alpha'), venue(2, 'Beta')],
  syncedAt: '2026-06-01T00:00:00Z',
};

beforeEach(() => {
  clearVenuesCache();
});

describe('venuesPersistentCache — Stage 3 slim row', () => {
  it('round-trips a slim 12-field venue (no city / city_id / approved / timestamps)', () => {
    writeVenueScope('Berlin', null, SCOPE);
    const read = readVenueScope('Berlin', null);
    expect(read?.venues).toHaveLength(2);
    const v = read?.venues[0] as unknown as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual([
      'address', 'condition', 'free_access', 'id', 'lat', 'lng',
      'name', 'nets', 'night_lighting', 'tables_count', 'type', 'verified',
    ]);
    expect(v.city).toBeUndefined();
    expect(v.city_id).toBeUndefined();
    expect(read?.v).toBe(VENUES_CACHE_SCHEMA_VERSION);
  });

  it('treats a previous-version envelope as a miss (forces the since=null re-pull)', () => {
    // Simulate an old 17-field scope cached at the prior version.
    store.set(
      'scope:Berlin:all',
      JSON.stringify({ v: VENUES_CACHE_SCHEMA_VERSION - 1, venues: [{ id: 1, name: 'Old', city: 'Berlin' }], syncedAt: 's' }),
    );
    expect(readVenueScope('Berlin', null)).toBeNull();
  });

  it('merges upserts by id and removes tombstones with the slim shape', () => {
    writeVenueScope('Berlin', null, SCOPE);
    const next = applyVenuesDelta('Berlin', null, [venue(2, 'Beta v2'), venue(3, 'Gamma')], [1], 't2');
    expect(next.venues.map((v) => v.id).sort()).toEqual([2, 3]); // 1 tombstoned, 3 added
    expect(next.venues.find((v) => v.id === 2)?.name).toBe('Beta v2'); // upsert replaced by id
    expect(next.syncedAt).toBe('t2');
  });
});
