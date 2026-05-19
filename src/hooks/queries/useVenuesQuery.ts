import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getVenuesDelta } from '../../services/venuesDelta';
import {
  applyVenuesDelta,
  readVenueScope,
  type PersistedVenue,
} from '../../lib/venuesPersistentCache';

type VenueType = string;

export const venuesQueryKey = (city?: string | null, type?: VenueType | null) =>
  ['venues', city ?? 'all', type ?? 'all'] as const;

/**
 * Persistent, delta-synced venues hook.
 *
 * Flow on every call:
 *   1. Hydrate instantly from the on-device MMKV cache via `initialData`
 *      (zero network, sub-ms paint).
 *   2. Background-fire `get_venues_delta(since=cache.syncedAt)` — returns
 *      only rows changed/added/deleted since last sync. Cold-start (no
 *      cache) gets the full set.
 *   3. Apply the delta to MMKV (in-place merge: tombstones removed,
 *      upserts replace existing rows by id) and return the merged list.
 *
 * If the network call fails we fall back to whatever the cache already
 * holds — the screen never blocks on a flaky connection.
 */
export function useVenuesQuery(
  city?: string | null,
  type?: VenueType | null,
  enabled = true,
  cityId?: number | null,
) {
  const stableCityId = cityId != null && cityId > 0 ? cityId : null;

  return useQuery<PersistedVenue[]>({
    queryKey: ['venues', stableCityId ?? city ?? 'all', type ?? 'all'] as const,
    queryFn: async () => {
      const scope = stableCityId != null ? `id:${stableCityId}` : city;
      const cached = readVenueScope(scope, type);
      const since = cached?.syncedAt ?? null;
      const { data, error } = await getVenuesDelta(since, city, type, stableCityId);

      if (error || !data) {
        if (cached) return cached.venues;
        throw error ?? new Error('venues delta failed and no cache available');
      }

      const next = applyVenuesDelta(
        scope,
        type,
        data.upserts ?? [],
        data.tombstone_ids ?? [],
        data.synced_at,
      );
      return next.venues;
    },
    initialData: () => readVenueScope(stableCityId != null ? `id:${stableCityId}` : city, type)?.venues,
    enabled,
    staleTime: 30 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useInvalidateVenues() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['venues'], exact: false });
}
