import { useQuery } from '@tanstack/react-query';
import { getExplorerQuestAwards, type ExplorerQuestAward } from '../../../services/explorer';

export const explorerQuestAwardsQueryKey = (
  userId: string | undefined,
) => ['explorerQuestAwards', userId ?? null] as const;

export function useExplorerQuestAwardsQuery(userId: string | undefined) {
  return useQuery<ExplorerQuestAward[]>({
    queryKey: explorerQuestAwardsQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getExplorerQuestAwards(userId!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
}
