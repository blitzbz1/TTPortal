// F051: explorer-quest progress hook. Mirrors useLeaderboardQuery — queryFn
// calls the service then saveCached*; initialData hydrates from loadCached*.
import { useQuery } from '@tanstack/react-query';
import { getExplorerProgress, type ExplorerProgress } from '../../../services/explorer';
import { loadCachedExplorerProgress, saveCachedExplorerProgress } from '../cache';

export const explorerProgressQueryKey = (
  userId: string | undefined,
  city: string | null | undefined,
) => ['explorerProgress', userId ?? null, city ?? null] as const;

export function useExplorerProgressQuery(
  userId: string | undefined,
  city: string | null | undefined,
) {
  return useQuery<ExplorerProgress[]>({
    queryKey: explorerProgressQueryKey(userId, city),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await getExplorerProgress(city);
      if (error) throw error;
      const next = data ?? [];
      saveCachedExplorerProgress(userId, city, next);
      return next;
    },
    initialData: () => loadCachedExplorerProgress(userId, city)?.data,
    initialDataUpdatedAt: () => Date.now() - 1000,
    staleTime: 2 * 60 * 1000,
  });
}
