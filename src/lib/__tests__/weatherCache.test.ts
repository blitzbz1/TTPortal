import { createMMKV } from 'react-native-mmkv';
import { loadCachedWeather, saveCachedWeather } from '../weatherCache';

const store = createMMKV({ id: 'offline-kv-cache' });

const W = { temp_c: 21, wind_kmh: 8, weather_code: 1, raining_now: false, rain_at: null, fetched_at: '2026-06-16T10:00:00Z' };

describe('weatherCache', () => {
  beforeEach(() => {
    for (const key of store.getAllKeys()) if (!key.startsWith('__')) store.remove(key);
  });

  it('round-trips a summary and reports it fresh right after save', () => {
    saveCachedWeather(44.4268, 26.1025, W);
    const r = loadCachedWeather<typeof W>(44.4268, 26.1025);
    expect(r?.data).toEqual(W);
    expect(r?.fresh).toBe(true);
  });

  it('shares one entry across coordinates in the same ~1km cell (toFixed(2))', () => {
    saveCachedWeather(44.4268, 26.1025, W); // -> key 44.43,26.10
    // A different raw coord that rounds to the same cell reads the same entry.
    expect(loadCachedWeather<typeof W>(44.4271, 26.1041)?.data).toEqual(W);
  });

  it('returns null for an uncached cell', () => {
    expect(loadCachedWeather(40.0, 20.0)).toBeNull();
  });
});
