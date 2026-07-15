import { useQuery } from '@tanstack/react-query';
import { getReviewsForVenue } from '../../services/reviews';

export const venueReviewsQueryKey = (venueId: number) => ['venue-reviews', venueId] as const;

// Full reviews list. The bundled get_venue_detail RPC already returns the
// top 5; this hook is enabled lazily by the screen once the user has
// expressed interest in the reviews section (scrolled, expanded, etc.).
export function useVenueReviewsQuery(venueId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: venueReviewsQueryKey(venueId ?? 0),
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await getReviewsForVenue(venueId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!venueId && enabled,
    staleTime: 2 * 60 * 1000,
  });
}
