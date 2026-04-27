import { useQuery } from '@tanstack/react-query';
import { getLeaderboard } from '../../services/leaderboard';

type LeaderboardType = Parameters<typeof getLeaderboard>[0];
type LeaderboardPeriod = Parameters<typeof getLeaderboard>[2];

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
      return (data ?? []) as any[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
