import { useQuery } from '@tanstack/react-query';
import { getCities } from '../../services/cities';

export const citiesQueryKey = ['cities', 'active'] as const;

export function useCitiesQuery() {
  return useQuery({
    queryKey: citiesQueryKey,
    queryFn: async () => {
      const { data, error } = await getCities();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
