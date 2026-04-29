import { useQuery } from '@tanstack/react-query';
import { getFriendFeed } from '../../services/feed';

export const feedQueryKey = (friendIds: string[]) =>
  ['feed', [...friendIds].sort().join(',')] as const;

export function useFeedQuery(friendIds: string[], enabled = true) {
  return useQuery({
    queryKey: feedQueryKey(friendIds),
    queryFn: async () => {
      const { data, error } = await getFriendFeed(friendIds);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
    enabled: enabled && friendIds.length > 0,
  });
}
