// MMKV-backed since T047 (the jest MMKV mock persists in-memory, so real
// round-trip behavior is assertable — the old SQLite version could only be
// smoke-tested).
import { createMMKV } from 'react-native-mmkv';
import {
  setCacheItem,
  getCacheItem,
  getCacheAge,
  removeCacheItem,
  removeCacheItemsByPrefix,
} from '../offline-cache';
import { KV_CACHE_SCHEMA_VERSION } from '../cacheSchema';

const store = createMMKV({ id: 'offline-kv-cache' });

describe('offline-cache', () => {
  beforeEach(() => {
    // Keep the schema-version row; clear data keys.
    for (const key of store.getAllKeys()) {
      if (!key.startsWith('__')) store.remove(key);
    }
  });

  it('round-trips values through set/get', () => {
    const testData = { venues: [{ id: 1, name: 'Test' }] };
    setCacheItem('test_key', testData);
    expect(getCacheItem('test_key')).toEqual(testData);
  });

  it('returns null for non-existent keys', () => {
    expect(getCacheItem('non_existent_key')).toBeNull();
    expect(getCacheAge('non_existent_key')).toBeNull();
  });

  it('tracks age from write time', () => {
    setCacheItem('aged', 1);
    const age = getCacheAge('aged');
    expect(age).not.toBeNull();
    expect(age!).toBeGreaterThanOrEqual(0);
    expect(age!).toBeLessThan(5_000);
  });

  it('removes single keys and by prefix', () => {
    setCacheItem('events:u1:upcoming', [1]);
    setCacheItem('events:u1:past', [2]);
    setCacheItem('events:u2:upcoming', [3]);

    removeCacheItem('events:u1:past');
    expect(getCacheItem('events:u1:past')).toBeNull();

    removeCacheItemsByPrefix('events:u1:');
    expect(getCacheItem('events:u1:upcoming')).toBeNull();
    expect(getCacheItem('events:u2:upcoming')).toEqual([3]);
  });

  it('treats corrupted envelopes as misses', () => {
    store.set('corrupt', '{not json');
    expect(getCacheItem('corrupt')).toBeNull();
    expect(getCacheAge('corrupt')).toBeNull();
  });

  it('seeds the KV schema version row on init', () => {
    // The global MMKV reset (jest.setup.afterEnv) wipes the row written at
    // module import — re-import a fresh copy to exercise ensureSchema.
    jest.isolateModules(() => {
      require('../offline-cache');
    });
    // Gates on the KV-only constant, not a shared global (T012).
    expect(store.getString('__schema_version__')).toBe(String(KV_CACHE_SCHEMA_VERSION));
  });

  it('functions do not throw', () => {
    expect(() => setCacheItem('k', { data: 1 })).not.toThrow();
    expect(() => getCacheItem('k')).not.toThrow();
    expect(() => getCacheAge('k')).not.toThrow();
  });
});
