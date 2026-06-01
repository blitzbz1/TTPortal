import { useQuery } from '@tanstack/react-query';
import { getFriends, getPendingRequests } from '../../services/friends';

export const friendsQueryKey = (userId: string | undefined) => ['friends', userId] as const;
export const pendingFriendsQueryKey = (userId: string | undefined) =>
  ['friends', 'pending', userId] as const;

export function useFriendsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: friendsQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getFriends(userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function usePendingFriendRequestsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: pendingFriendsQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getPendingRequests(userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
