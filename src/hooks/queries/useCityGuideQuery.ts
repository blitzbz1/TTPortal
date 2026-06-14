import { useQuery } from '@tanstack/react-query';
import { getCityGuide, type CityGuide } from '../../services/cityGuide';

export const cityGuideQueryKey = (cityId: number | undefined) =>
  ['city-guide', cityId ?? null] as const;

/**
 * Public city guide (F015) — anon-readable aggregate. No persistent cache: the
 * route is meant for fresh, shareable, pre-install web views.
 */
export function useCityGuideQuery(cityId: number | undefined) {
  return useQuery<CityGuide | null>({
    queryKey: cityGuideQueryKey(cityId),
    enabled: cityId != null && cityId > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (cityId == null) return null;
      const { data, error } = await getCityGuide(cityId);
      if (error) throw error;
      return data;
    },
  });
}
