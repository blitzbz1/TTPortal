import { useQuery } from '@tanstack/react-query';
import { getPlayerRating, type PlayerRating } from '../../../services/ratings';
import { loadCachedRating, saveCachedRating } from '../../../lib/ratingsCache';

export const playerRatingQueryKey = (userId: string | undefined) =>
  ['rating', userId ?? null] as const;

/** Cache-first rating (chip + sparkline). Returns null for an unrated player. */
export function usePlayerRatingQuery(userId: string | undefined) {
  return useQuery<PlayerRating | null>({
    queryKey: playerRatingQueryKey(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await getPlayerRating(userId);
      if (error) throw error;
      saveCachedRating(userId, data);
      return data;
    },
    initialData: () => (userId ? loadCachedRating<PlayerRating | null>(userId)?.data : undefined),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
