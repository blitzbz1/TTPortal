import { createMMKV } from 'react-native-mmkv';
import {
  loadCachedVenueIntel,
  saveCachedVenueIntel,
  invalidateVenueIntelCache,
} from '../venueIntelCache';

const store = createMMKV({ id: 'offline-kv-cache' });

const INTEL = {
  busyness: { live_count: 3, sample_size: 120, histogram: null },
  freeTables: null,
  amenities: null,
  regulars: null,
};

describe('venueIntelCache', () => {
  beforeEach(() => {
    for (const key of store.getAllKeys()) if (!key.startsWith('__')) store.remove(key);
  });

  it('round-trips a bundle per venue and reports it fresh right after save', () => {
    saveCachedVenueIntel(42, INTEL);
    const r = loadCachedVenueIntel<typeof INTEL>(42);
    expect(r?.data).toEqual(INTEL);
    expect(r?.fresh).toBe(true);
  });

  it('scopes entries by venue id', () => {
    saveCachedVenueIntel(42, INTEL);
    expect(loadCachedVenueIntel(43)).toBeNull();
  });

  it('invalidate drops the persisted bundle (so a stale live count cannot rehydrate)', () => {
    saveCachedVenueIntel(42, INTEL);
    invalidateVenueIntelCache(42);
    expect(loadCachedVenueIntel(42)).toBeNull();
  });
});
