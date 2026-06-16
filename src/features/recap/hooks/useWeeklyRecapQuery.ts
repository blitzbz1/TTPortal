// F052: weekly-recap hook. Mirrors useLeaderboardQuery — queryFn calls the
// service then saveCached*; initialData hydrates from loadCached*.
import { useQuery } from '@tanstack/react-query';
import { getWeeklyRecap, type WeeklyRecap } from '../../../services/recap';
import { loadCachedWeeklyRecap, saveCachedWeeklyRecap } from '../cache';

export const weeklyRecapQueryKey = (
  userId: string | undefined,
  weekStart: string | null | undefined,
) => ['weeklyRecap', userId ?? null, weekStart ?? null] as const;

export function useWeeklyRecapQuery(
  userId: string | undefined,
  weekStart?: string | null,
) {
  return useQuery<WeeklyRecap | null>({
    queryKey: weeklyRecapQueryKey(userId, weekStart),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getWeeklyRecap(userId as string, weekStart);
      if (error) throw error;
      if (data) saveCachedWeeklyRecap(userId, weekStart, data);
      return data;
    },
    initialData: () => loadCachedWeeklyRecap(userId, weekStart)?.data,
    initialDataUpdatedAt: () => Date.now() - 1000,
    staleTime: 10 * 60 * 1000,
  });
}
