import { useQuery } from '@tanstack/react-query';
import { getVenues } from '../../services/venues';

type VenueType = Parameters<typeof getVenues>[1];

export const venuesQueryKey = (city?: string, type?: VenueType) =>
  ['venues', city ?? null, type ?? null] as const;

export function useVenuesQuery(city?: string, type?: VenueType, enabled = true) {
  return useQuery({
    queryKey: venuesQueryKey(city, type),
    queryFn: async () => {
      const { data, error } = await getVenues(city, type);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
