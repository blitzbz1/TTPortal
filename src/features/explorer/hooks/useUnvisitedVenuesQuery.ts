// F051: the "new to you" set for map pins — venue ids in the selected city the
// caller has not checked into. One round-trip; returns a stable Set<number>.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUnvisitedVenueIds } from '../../../services/explorer';

const EMPTY_SET: Set<number> = new Set();

export const unvisitedVenuesQueryKey = (
  userId: string | undefined,
  city: string | null | undefined,
) => ['unvisitedVenues', userId ?? null, city ?? null] as const;

export function useUnvisitedVenuesQuery(
  userId: string | undefined,
  city: string | null | undefined,
) {
  const query = useQuery<number[]>({
    queryKey: unvisitedVenuesQueryKey(userId, city),
    enabled: !!userId && !!city,
    queryFn: async () => {
      const { data, error } = await getUnvisitedVenueIds(city as string);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Stable Set identity while the id list is referentially stable (react-query
  // structural sharing) so the memoized VenueMarkers layer doesn't churn.
  const unvisitedVenueIds = useMemo(
    () => (query.data && query.data.length > 0 ? new Set(query.data) : EMPTY_SET),
    [query.data],
  );

  return { ...query, unvisitedVenueIds };
}
