import { useQuery } from '@tanstack/react-query';
import { getCityVenueAmenities } from '../../../services/venueIntel';
import type { VenueAmenities } from '../../../lib/amenities';

export const cityVenueAmenitiesQueryKey = (cityId: number | null | undefined) =>
  ['city-venue-amenities', cityId ?? 'all'] as const;

/**
 * Per-venue amenities for the selected city (F012), as a Map for O(1) lookup
 * by the map filter chips ("free entry" / "rental"). Amenities change rarely,
 * so this caches longer than the live-count overlay; a failed fetch yields an
 * empty map (chips simply match nothing).
 */
export function useCityVenueAmenitiesQuery(cityId: number | null | undefined) {
  return useQuery<Map<number, VenueAmenities>>({
    queryKey: cityVenueAmenitiesQueryKey(cityId),
    queryFn: async () => {
      const { data, error } = await getCityVenueAmenities(cityId ?? null);
      const m = new Map<number, VenueAmenities>();
      if (error) return m;
      for (const row of data) {
        if (typeof row.venue_id === 'number' && row.amenities) {
          m.set(row.venue_id, row.amenities);
        }
      }
      return m;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
