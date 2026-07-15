import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { applyCitiesDelta, readCities, getCleanedCities, type PersistedCity } from '../../lib/citiesPersistentCache';
import { cleanCityCatalog } from '../../lib/cityCatalog';
import { getCitiesDelta } from '../../services/citiesDelta';
import { traceSegmentOnce } from '../../lib/launchTrace';

export const citiesQueryKey = ['cities', 'delta'] as const;

/**
 * Persistent, delta-synced cities list.
 *
 * Cities change very rarely. After the first sync, every subsequent open
 * ships zero or one row. Cache survives app restarts (MMKV).
 */
export function useCitiesQuery(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const query = useQuery<PersistedCity[]>({
    queryKey: citiesQueryKey,
    enabled,
    queryFn: async () => {
      const cached = readCities();
      const since = cached?.syncedAt ?? null;
      const { data, error } = await getCitiesDelta(since);
      if (error || !data) {
        if (cached) return getCleanedCities() ?? cleanCityCatalog(cached.cities);
        throw error ?? new Error('cities delta failed and no cache');
      }
      // T021: the common warm case is a no-op delta. Skip the merge, the
      // compareRo sort, AND the 3.35 MB writeCities stringify entirely, and
      // serve the shared memoized clean. Deliberately do NOT advance syncedAt —
      // the next sync just re-requests the same empty delta (cheap + correct).
      const noChange =
        (data.upserts?.length ?? 0) === 0 && (data.tombstone_ids?.length ?? 0) === 0;
      if (noChange && cached) {
        return getCleanedCities() ?? cleanCityCatalog(cached.cities);
      }
      // T020: pass the already-read cache so applyCitiesDelta skips its own parse.
      const next = applyCitiesDelta(
        data.upserts ?? [],
        data.tombstone_ids ?? [],
        data.synced_at,
        cached,
      );
      return cleanCityCatalog(next.cities);
    },
    // Stage 1.5: when disabled (the root LocationProvider defers the catalog off
    // the synchronous mount path), initialData is undefined, so the 3.35 MB
    // readCities parse + clean never run on first paint. Once enabled
    // (post-first-paint via InteractionManager, or on switcher-open), queryFn
    // hydrates from cache + syncs the delta. Direct callers (AddVenueScreen,
    // VenueEditModal) omit the arg → enabled=true → unchanged eager hydration.
    initialData: enabled
      ? () => {
          // T022: parse once (readCities, timed as 'cities: JSON.parse'), then
          // the shared memoized clean — initialData and the queryFn no-change
          // path clean the catalog at most once between them.
          const cached = readCities();
          if (!cached) return undefined;
          // T003 (Stage M): time the clean+compareRo sort in isolation (the
          // memo-hit readCities inside getCleanedCities is ~free, so this Δ is the
          // sort alone), to settle whether parse or sort dominates.
          return traceSegmentOnce('cities: cleanCityCatalog sort', () => getCleanedCities());
        }
      : undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    gcTime: 24 * 60 * 60 * 1000,
  });

  // NOTE: must NOT depend on `query.data`. This callback calls setQueryData,
  // which changes query.data — depending on it would give refreshCatalog a new
  // identity every run, and any effect keyed on it (e.g. LocationSelector's
  // refresh-on-open) would re-fire forever, looping full-catalog fetches and
  // re-cleaning ~10k cities each pass (the switch-city modal freeze). Read the
  // current data imperatively instead so the identity stays stable.
  const refreshCatalog = useCallback(async () => {
    const { data, error } = await getCitiesDelta(null);
    if (error || !data) {
      const current = queryClient.getQueryData<PersistedCity[]>(citiesQueryKey);
      if (current) return current;
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
  }, [queryClient]);

  return {
    ...query,
    refreshCatalog,
  };
}
