import { useQuery } from '@tanstack/react-query';
import { getVenueCoaches } from '../../../services/coaches';
import type { VenueCoach } from '../../../types/database';

export const venueCoachesQueryKey = (venueId: number | undefined) =>
  ['venue-coaches', venueId ?? 'none'] as const;

/**
 * Approved coaches at a venue (F063), feeding the lazy "Coaches here" row. Kept
 * OUT of get_venue_detail's critical path (like VenueMomentsStrip /
 * VenueBoardSection) — a best-effort secondary query. A failure yields [].
 */
export function useVenueCoachesQuery(venueId: number | undefined, enabled = true) {
  return useQuery<VenueCoach[]>({
    queryKey: venueCoachesQueryKey(venueId),
    queryFn: async () => {
      if (!venueId) return [];
      const { data } = await getVenueCoaches(venueId);
      return data;
    },
    enabled: enabled && !!venueId,
    staleTime: 10 * 60 * 1000,
  });
}
