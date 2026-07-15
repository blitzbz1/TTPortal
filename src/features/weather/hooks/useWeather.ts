import { useQuery } from '@tanstack/react-query';
import { getWeather, type WeatherSummary } from '../../../services/weather';
import { cachedUpdatedAt } from '../../../lib/cacheUtils';
import { loadCachedWeather, saveCachedWeather } from '../../../lib/weatherCache';

export const weatherQueryKey = (lat: number | null | undefined, lng: number | null | undefined) =>
  ['weather', lat != null ? lat.toFixed(2) : null, lng != null ? lng.toFixed(2) : null] as const;

/**
 * Current weather summary for a coordinate (F013). Returns null on any error
 * so callers (the chip/banner) simply render nothing — weather is decorative,
 * never blocking. Disabled unless coordinates are present and `enabled` (the
 * caller gates on outdoor venues / a selected city).
 *
 * Mirrors to the persistent weatherCache (per ~1km cell, 30-min TTL): a coord
 * fetched within the last 30 min — in memory OR on disk, even across launches —
 * hydrates instantly and skips the network; older data refetches in the
 * background. The TTL matches the server weather_cache refresh window.
 */
export function useWeatherQuery(
  lat: number | null | undefined,
  lng: number | null | undefined,
  enabled = true,
) {
  return useQuery<WeatherSummary | null>({
    queryKey: weatherQueryKey(lat, lng),
    enabled: enabled && lat != null && lng != null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      if (lat == null || lng == null) return null;
      const { data } = await getWeather(lat, lng);
      if (data) saveCachedWeather<WeatherSummary>(lat, lng, data);
      return data;
    },
    initialData: () =>
      lat != null && lng != null ? loadCachedWeather<WeatherSummary>(lat, lng)?.data : undefined,
    initialDataUpdatedAt: () =>
      lat != null && lng != null ? cachedUpdatedAt(loadCachedWeather<WeatherSummary>(lat, lng)) : undefined,
  });
}
