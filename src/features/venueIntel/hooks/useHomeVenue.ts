import { useQuery } from '@tanstack/react-query';
import { getHomeVenue, suggestHomeVenue, type HomeVenue } from '../../../services/venueIntel';

export const homeVenueQueryKey = (userId: string | undefined) =>
  ['home-venue', userId ?? null] as const;
export const homeVenueSuggestionQueryKey = (userId: string | undefined) =>
  ['home-venue-suggestion', userId ?? null] as const;

/** A user's home venue (id + name) for the "plays at X" line (F014). */
export function useHomeVenueQuery(userId: string | undefined) {
  return useQuery<HomeVenue | null>({
    queryKey: homeVenueQueryKey(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await getHomeVenue(userId);
      return data;
    },
  });
}

/**
 * Auto-suggested home venue from the caller's check-in history (F014). Only
 * meaningful for the signed-in user; `enabled` gates it (e.g. only when no
 * home venue is set yet).
 */
export function useHomeVenueSuggestionQuery(userId: string | undefined, enabled = true) {
  return useQuery<HomeVenue | null>({
    queryKey: homeVenueSuggestionQueryKey(userId),
    enabled: !!userId && enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await suggestHomeVenue();
      return data;
    },
  });
}
