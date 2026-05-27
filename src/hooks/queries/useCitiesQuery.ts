import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { applyCitiesDelta, readCities, type PersistedCity } from '../../lib/citiesPersistentCache';
import { cleanCityCatalog } from '../../lib/cityCatalog';
import { getCitiesDelta } from '../../services/citiesDelta';

export const citiesQueryKey = ['cities', 'delta'] as const;

/**
 * Persistent, delta-synced cities list.
 *
 * Cities change very rarely. After the first sync, every subsequent open
 * ships zero or one row. Cache survives app restarts (MMKV).
 */
export function useCitiesQuery() {
  const queryClient = useQueryClient();
  const query = useQuery<PersistedCity[]>({
    queryKey: citiesQueryKey,
    queryFn: async () => {
      const cached = readCities();
      const since = cached?.syncedAt ?? null;
      const { data, error } = await getCitiesDelta(since);
      if (error || !data) {
        if (cached) return cleanCityCatalog(cached.cities);
        throw error ?? new Error('cities delta failed and no cache');
      }
      const next = applyCitiesDelta(
        data.upserts ?? [],
        data.tombstone_ids ?? [],
        data.synced_at,
      );
      return cleanCityCatalog(next.cities);
    },
    initialData: () => {
      const cached = readCities();
      return cached ? cleanCityCatalog(cached.cities) : undefined;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const refreshCatalog = useCallback(async () => {
    const { data, error } = await getCitiesDelta(null);
    if (error || !data) {
      if (query.data) return query.data;
      throw error ?? new Error('cities full refresh failed and no cache');
    }
    const next = applyCitiesDelta(
      data.upserts ?? [],
      data.tombstone_ids ?? [],
      data.synced_at,
    );
    const cleaned = cleanCityCatalog(next.cities);
    queryClient.setQueryData(citiesQueryKey, cleaned);
    return cleaned;
  }, [query.data, queryClient]);

  return {
    ...query,
    refreshCatalog,
  };
}
