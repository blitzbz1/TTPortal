import { useQuery } from '@tanstack/react-query';
import { applyCitiesDelta, readCities, type PersistedCity } from '../../lib/citiesPersistentCache';
import { getCitiesDelta } from '../../services/citiesDelta';

export const citiesQueryKey = ['cities', 'delta'] as const;

/**
 * Persistent, delta-synced cities list.
 *
 * Cities change very rarely. After the first sync, every subsequent open
 * ships zero or one row. Cache survives app restarts (MMKV).
 */
export function useCitiesQuery() {
  return useQuery<PersistedCity[]>({
    queryKey: citiesQueryKey,
    queryFn: async () => {
      const cached = readCities();
      const since = cached?.syncedAt ?? null;
      const { data, error } = await getCitiesDelta(since);
      if (error || !data) {
        if (cached) return cached.cities;
        throw error ?? new Error('cities delta failed and no cache');
      }
      const next = applyCitiesDelta(
        data.upserts ?? [],
        data.tombstone_ids ?? [],
        data.synced_at,
      );
      return next.cities;
    },
    initialData: () => readCities()?.cities,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
