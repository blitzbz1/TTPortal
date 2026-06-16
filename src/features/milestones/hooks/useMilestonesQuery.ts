// F053: earned-milestones hook. Mirrors useExplorerProgressQuery /
// useLeaderboardQuery — queryFn calls the service then saveCached*; initialData
// hydrates from loadCached*.
import { useQuery } from '@tanstack/react-query';
import { getUserMilestones, type UserMilestone } from '../../../services/milestones';
import { loadCachedMilestones, saveCachedMilestones } from '../cache';

export const milestonesQueryKey = (userId: string | undefined) =>
  ['userMilestones', userId ?? null] as const;

export function useMilestonesQuery(userId: string | undefined) {
  return useQuery<UserMilestone[]>({
    queryKey: milestonesQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getUserMilestones();
      if (error) throw error;
      const next = data ?? [];
      saveCachedMilestones(userId, next);
      return next;
    },
    initialData: () => loadCachedMilestones(userId)?.data,
    initialDataUpdatedAt: () => Date.now() - 1000,
    staleTime: 2 * 60 * 1000,
  });
}
