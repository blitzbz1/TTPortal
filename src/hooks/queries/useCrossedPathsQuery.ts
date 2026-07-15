import { useQuery } from '@tanstack/react-query';
import { getCrossedPaths, type CrossedPath } from '../../services/feed';

// F022: live "you crossed paths" suggestions. Ephemeral (like
// useFriendsAtVenueQuery) — no persistent cache. userId stays in the key for
// account-switch isolation even though the server derives it from auth.uid().
export const crossedPathsQueryKey = (userId: string | undefined) =>
  ['crossed-paths', userId ?? null] as const;

export function useCrossedPathsQuery(userId: string | undefined) {
  return useQuery<CrossedPath[]>({
    queryKey: crossedPathsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getCrossedPaths();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
