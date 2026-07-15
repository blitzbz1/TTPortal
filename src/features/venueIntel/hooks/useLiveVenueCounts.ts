import { useQuery } from '@tanstack/react-query';
import { getLiveVenueCounts } from '../../../services/venueIntel';

export const liveVenueCountsQueryKey = (cityId: number | null | undefined) =>
  ['live-venue-counts', cityId ?? 'all'] as const;

/**
 * Anonymous live check-in counts per venue for the selected city (F010),
 * shaped as a Map for O(1) marker lookup — same role useFriendPresenceQuery's
 * Set plays for the friend badge. Live data, so it is never mirrored to the
 * persistent cache; a short staleTime keeps it feeling live without refetching
 * on every tab switch. A failed fetch yields an empty map (no dots), never an
 * error the map has to handle.
 */
export function useLiveVenueCountsQuery(cityId: number | null | undefined) {
  return useQuery<Map<number, number>>({
    queryKey: liveVenueCountsQueryKey(cityId),
    queryFn: async () => {
      const { data, error } = await getLiveVenueCounts(cityId ?? null);
      if (error) return new Map<number, number>();
      const m = new Map<number, number>();
      for (const row of data) {
        if (typeof row.venue_id === 'number' && row.active_count > 0) {
          m.set(row.venue_id, row.active_count);
        }
      }
      return m;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
