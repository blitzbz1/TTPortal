// F054: year-in-review hook. Mirrors useWeeklyRecapQuery / useLeaderboardQuery —
// queryFn calls the service then saveCached*; initialData hydrates from
// loadCached*.
import { useQuery } from '@tanstack/react-query';
import { getYearInReview, type YearInReview } from '../../../services/wrapped';
import { loadCachedYearInReview, saveCachedYearInReview } from '../cache';

export const yearInReviewQueryKey = (
  userId: string | undefined,
  year: number | null | undefined,
) => ['yearInReview', userId ?? null, year ?? null] as const;

export function useYearInReviewQuery(
  userId: string | undefined,
  year?: number | null,
) {
  return useQuery<YearInReview | null>({
    queryKey: yearInReviewQueryKey(userId, year),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getYearInReview(userId as string, year);
      if (error) throw error;
      if (data) saveCachedYearInReview(userId, year, data);
      return data;
    },
    initialData: () => loadCachedYearInReview(userId, year)?.data,
    initialDataUpdatedAt: () => Date.now() - 1000,
    staleTime: 60 * 60 * 1000,
  });
}
