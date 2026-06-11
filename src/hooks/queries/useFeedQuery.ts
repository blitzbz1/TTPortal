import { useQuery } from '@tanstack/react-query';
import { getFriendFeed } from '../../services/feed';

export const feedQueryKey = (userId: string | undefined) =>
  ['feed', userId ?? null] as const;

export function useFeedQuery(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: feedQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getFriendFeed();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
    enabled: enabled && !!userId,
  });
}
