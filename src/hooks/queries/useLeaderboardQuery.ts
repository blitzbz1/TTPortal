import { useQuery } from '@tanstack/react-query';
import { getLeaderboard } from '../../services/leaderboard';
import { loadCachedLeaderboard, saveCachedLeaderboard } from '../../lib/leaderboardCache';

type LeaderboardType = Parameters<typeof getLeaderboard>[0];
type LeaderboardPeriod = NonNullable<Parameters<typeof getLeaderboard>[2]>;

export const leaderboardQueryKey = (
  type: LeaderboardType,
  city: string | undefined,
  period: LeaderboardPeriod,
) => ['leaderboard', type, city ?? null, period] as const;

export function useLeaderboardQuery(
  type: LeaderboardType,
  city: string | undefined,
  period: LeaderboardPeriod,
) {
  return useQuery<any[]>({
    queryKey: leaderboardQueryKey(type, city, period),
    queryFn: async () => {
      const { data, error } = await getLeaderboard(type, city, period);
      if (error) throw error;
      const next = (data ?? []) as any[];
      // Mirror to the SQLite-backed cache so the next app launch (after
      // the React Query in-memory cache is gone) renders instantly.
      saveCachedLeaderboard(type, city, period, next);
      return next;
    },
    // Seed the query with whatever's already on disk. The query still
    // refetches in the background — staleTime keeps it from refetching
    // on every screen visit within the window.
    initialData: () => {
      const cached = loadCachedLeaderboard<any>(type, city, period);
      return cached?.data;
    },
    initialDataUpdatedAt: () => Date.now() - 1000,
    staleTime: 2 * 60 * 1000,
  });
}
