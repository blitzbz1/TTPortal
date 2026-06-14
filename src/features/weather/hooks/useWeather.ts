import { useQuery } from '@tanstack/react-query';
import { getWeather, type WeatherSummary } from '../../../services/weather';

export const weatherQueryKey = (lat: number | null | undefined, lng: number | null | undefined) =>
  ['weather', lat != null ? lat.toFixed(2) : null, lng != null ? lng.toFixed(2) : null] as const;

/**
 * Current weather summary for a coordinate (F013). Returns null on any error
 * so callers (the chip/banner) simply render nothing — weather is decorative,
 * never blocking. Disabled unless coordinates are present and `enabled` (the
 * caller gates on outdoor venues / a selected city).
 */
export function useWeatherQuery(
  lat: number | null | undefined,
  lng: number | null | undefined,
  enabled = true,
) {
  return useQuery<WeatherSummary | null>({
    queryKey: weatherQueryKey(lat, lng),
    enabled: enabled && lat != null && lng != null,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (lat == null || lng == null) return null;
      const { data } = await getWeather(lat, lng);
      return data;
    },
  });
}
