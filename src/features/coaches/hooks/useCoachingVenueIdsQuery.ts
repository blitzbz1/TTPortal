import { useQuery } from '@tanstack/react-query';
import { getCoachingVenueIds } from '../../../services/coaches';

export const coachingVenueIdsQueryKey = (city: string | null | undefined) =>
  ['coaching-venue-ids', city ?? 'all'] as const;

/**
 * The set of venue ids in a city that have ≥1 approved coach (F063), as a Set
 * for O(1) lookup by the map "Coaching" filter chip (like the cityAmenities
 * overlay). A failed fetch yields an empty set (the chip simply matches nothing).
 */
export function useCoachingVenueIdsQuery(city: string | null | undefined) {
  return useQuery<Set<number>>({
    queryKey: coachingVenueIdsQueryKey(city),
    queryFn: async () => {
      const { data, error } = await getCoachingVenueIds(city ?? null);
      if (error) return new Set<number>();
      return new Set<number>(data);
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
