// Stage 1 (T021 no-op short-circuit, T023 end-to-end guardrail). Uses the
// global jest.setup react-query mock (runs initialData + queryFn eagerly), the
// REAL cities cache/catalog (so the memos are exercised), and a mocked delta
// service.
import { renderHook, waitFor } from '@testing-library/react-native';
import { createMMKV } from 'react-native-mmkv';
import { useCitiesQuery } from '../useCitiesQuery';
import {
  writeCities,
  readCities,
  clearCitiesCache,
  type CitiesCache,
  type PersistedCity,
} from '../../../lib/citiesPersistentCache';
import * as cacheModule from '../../../lib/citiesPersistentCache';
import * as cityCatalog from '../../../lib/cityCatalog';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

const mockGetCitiesDelta = jest.fn();
jest.mock('../../../services/citiesDelta', () => ({
  getCitiesDelta: (...args: unknown[]) => mockGetCitiesDelta(...args),
}));

const store = createMMKV({ id: 'cities-cache-v2' });

function city(id: number, name: string): PersistedCity {
  return { id, name, county: null, lat: 1, lng: 2, zoom: 10, venue_count: 1, active: true, updated_at: 't' };
}

const SEED: CitiesCache = {
  cities: [city(2, 'Brno'), city(1, 'Praha')],
  syncedAt: 'orig',
};

/** JSON.parse calls whose argument is the current cities blob. */
function citiesParseCount(spy: jest.SpyInstance): number {
  const raw = store.getString('cities');
  return spy.mock.calls.filter((c) => c[0] === raw).length;
}

beforeEach(() => {
  clearCitiesCache();
  mockGetCitiesDelta.mockReset();
});

describe('useCitiesQuery — Stage 1 warm-delta optimizations', () => {
  it('T021 — a no-op warm delta skips applyCitiesDelta and never advances syncedAt', async () => {
    writeCities(SEED);
    mockGetCitiesDelta.mockResolvedValue({
      data: { upserts: [], tombstone_ids: [], synced_at: 'orig+1' },
      error: null,
    });
    const applySpy = jest.spyOn(cacheModule, 'applyCitiesDelta');

    const { result } = renderHook(() => useCitiesQuery());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(applySpy).not.toHaveBeenCalled(); // no merge ⇒ no writeCities stringify
    expect(readCities()?.syncedAt).toBe('orig'); // deliberately NOT advanced
    expect(result.current.data?.map((c) => c.id)).toEqual([2, 1]); // cleaned, compareRo-sorted
    applySpy.mockRestore();
  });

  it('T023 — warm empty-delta hydrate parses ≤1, cleans exactly once, writes zero', async () => {
    writeCities(SEED);
    mockGetCitiesDelta.mockResolvedValue({
      data: { upserts: [], tombstone_ids: [], synced_at: 'orig+1' },
      error: null,
    });
    const parseSpy = jest.spyOn(JSON, 'parse');
    const cleanSpy = jest.spyOn(cityCatalog, 'cleanCityCatalog');
    const applySpy = jest.spyOn(cacheModule, 'applyCitiesDelta');

    const { result } = renderHook(() => useCitiesQuery());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(citiesParseCount(parseSpy)).toBeLessThanOrEqual(1); // memo collapses the 3 parses
    expect(cleanSpy).toHaveBeenCalledTimes(1); // initialData + queryFn share one clean
    expect(applySpy).not.toHaveBeenCalled(); // zero writeCities
    expect(result.current.data?.map((c) => c.id)).toEqual([2, 1]);

    parseSpy.mockRestore();
    cleanSpy.mockRestore();
    applySpy.mockRestore();
  });

  it('Stage 1.5 — a disabled query parses nothing on mount (initialData gated off)', async () => {
    writeCities(SEED);
    mockGetCitiesDelta.mockResolvedValue({
      data: { upserts: [], tombstone_ids: [], synced_at: 'x' },
      error: null,
    });
    const parseSpy = jest.spyOn(JSON, 'parse');

    const { result } = renderHook(() => useCitiesQuery(false));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(citiesParseCount(parseSpy)).toBe(0); // no 3.35 MB readCities parse
    expect(result.current.data).toBeUndefined(); // no synchronous initialData seed
    expect(mockGetCitiesDelta).not.toHaveBeenCalled(); // queryFn gated by enabled
    parseSpy.mockRestore();
  });

  it('T023 contrast — a non-empty delta DOES write once and re-clean (guardrail is not a dead hook)', async () => {
    writeCities(SEED);
    mockGetCitiesDelta.mockResolvedValue({
      data: { upserts: [city(3, 'Cluj')], tombstone_ids: [], synced_at: 'orig+1' },
      error: null,
    });
    const applySpy = jest.spyOn(cacheModule, 'applyCitiesDelta');

    const { result } = renderHook(() => useCitiesQuery());
    await waitFor(() => expect(result.current.data?.length).toBe(3));

    expect(applySpy).toHaveBeenCalledTimes(1); // the real change is merged + written
    expect(readCities()?.syncedAt).toBe('orig+1'); // advanced ⇒ a write happened
    expect(
      result.current.data
        ?.map((c) => c.id)
        .slice()
        .sort((a, b) => a - b),
    ).toEqual([1, 2, 3]);
    applySpy.mockRestore();
  });
});

describe('useCitiesQuery — Stage 2 tiered catalog (T048)', () => {
  // The hook is unchanged: getCitiesDelta now targets get_cities_catalog_v2, so
  // the same delta→merge→clean flow operates on the ~1,500-row tier instead of
  // the full ~10,330 catalog. These pin the two behaviours the tier must keep.
  it('merges + cleans a tier upsert and preserves its server-built search_key', async () => {
    writeCities(SEED);
    mockGetCitiesDelta.mockResolvedValue({
      data: { upserts: [{ ...city(5, 'Sibiu'), search_key: 'sibiu' }], tombstone_ids: [], synced_at: 'orig+1' },
      error: null,
    });
    const { result } = renderHook(() => useCitiesQuery());
    await waitFor(() => expect(result.current.data?.length).toBe(3));
    expect(result.current.data?.find((c) => c.id === 5)?.search_key).toBe('sibiu');
  });

  it('keeps refreshCatalog identity stable across rerenders (the switch-city freeze guard)', async () => {
    writeCities(SEED);
    mockGetCitiesDelta.mockResolvedValue({ data: { upserts: [], tombstone_ids: [], synced_at: 'orig' }, error: null });
    const { result, rerender } = renderHook(() => useCitiesQuery());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const first = result.current.refreshCatalog;
    rerender({});
    expect(result.current.refreshCatalog).toBe(first);
  });
});
