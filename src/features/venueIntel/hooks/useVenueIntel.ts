import { useQuery } from '@tanstack/react-query';
import {
  getVenueBusyness,
  getVenueFreeTables,
  getVenueAmenities,
  getVenueRegulars,
  type VenueBusyness,
  type VenueFreeTables,
  type VenueRegulars,
} from '../../../services/venueIntel';
import type { VenueAmenities } from '../../../lib/amenities';
import { cachedUpdatedAt } from '../../../lib/cacheUtils';
import { loadCachedVenueIntel, saveCachedVenueIntel } from '../../../lib/venueIntelCache';

export interface VenueIntel {
  busyness: VenueBusyness | null;
  freeTables: VenueFreeTables | null;
  amenities: VenueAmenities | null;
  regulars: VenueRegulars | null;
}

export const venueIntelQueryKey = (venueId: number | undefined) =>
  ['venue-intel', venueId ?? null] as const;

/**
 * F010/F011/F012/F014 venue-intelligence extras (busyness, free-table reports,
 * amenities, regulars), fetched in ONE separate, best-effort query — completely
 * decoupled from the core venue load (useVenueDetailQuery). Each call is
 * isolated by `safe()` so a throw/rejection/undefined degrades that field to
 * null; the query itself can never error. This guarantees the venue-detail
 * screen renders off get_venue_detail alone, no matter what happens to the
 * intelligence layer.
 *
 * Mirrors to the persistent venueIntelCache (per venue, 10-min TTL): re-opening
 * a venue hydrates the last-known bundle instantly and skips the network within
 * the window; older data refetches in the background. The live "now" count is
 * last-known between refreshes. A free-tables/regulars mutation invalidates
 * both the query and this cache (see VenueDetailScreen).
 */
export function useVenueIntelQuery(venueId: number | undefined) {
  return useQuery<VenueIntel>({
    queryKey: venueIntelQueryKey(venueId),
    enabled: venueId != null && venueId > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const safe = async <T,>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T | null> => {
        try {
          const r = await fn();
          return r && !r.error ? (r.data ?? null) : null;
        } catch {
          return null;
        }
      };
      const [busyness, freeTables, amenities, regulars] = await Promise.all([
        safe(() => getVenueBusyness(venueId!)),
        safe(() => getVenueFreeTables(venueId!)),
        safe(() => getVenueAmenities(venueId!)),
        safe(() => getVenueRegulars(venueId!)),
      ]);
      const intel: VenueIntel = { busyness, freeTables, amenities, regulars };
      if (venueId != null) saveCachedVenueIntel<VenueIntel>(venueId, intel);
      return intel;
    },
    initialData: () =>
      venueId != null && venueId > 0 ? loadCachedVenueIntel<VenueIntel>(venueId)?.data : undefined,
    initialDataUpdatedAt: () =>
      venueId != null && venueId > 0 ? cachedUpdatedAt(loadCachedVenueIntel<VenueIntel>(venueId)) : undefined,
  });
}
