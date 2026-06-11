import { useQuery } from '@tanstack/react-query';
import { getFriends, getPendingRequests } from '../../services/friends';
import {
  loadCachedFriends,
  saveCachedFriends,
  loadCachedPending,
  saveCachedPending,
} from '../../lib/friendsCache';

export const friendsQueryKey = (userId: string | undefined) => ['friends', userId] as const;
export const pendingFriendsQueryKey = (userId: string | undefined) =>
  ['friends', 'pending', userId] as const;

/** Friendship row with the OTHER party surfaced as `friend` (T050: the
 * requester/addressee normalization used to live in FriendsScreen). */
export interface NormalizedFriendship {
  friend: { id?: string; full_name?: string | null; avatar_url?: string | null; city?: string | null; username?: string | null } | null;
  requester_id: string;
  addressee_id: string;
  [key: string]: unknown;
}

export function normalizeFriendships(rows: any[], userId: string): NormalizedFriendship[] {
  return rows.map((f: any) => {
    const isRequester = f.requester_id === userId;
    const profile = isRequester ? f.addressee : f.requester;
    return { ...f, friend: profile };
  });
}

export function useFriendsQuery(userId: string | undefined) {
  return useQuery<NormalizedFriendship[]>({
    queryKey: friendsQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getFriends(userId);
      if (error) throw error;
      const normalized = normalizeFriendships((data ?? []) as any[], userId);
      saveCachedFriends(userId, normalized);
      return normalized;
    },
    initialData: () => (userId ? loadCachedFriends<NormalizedFriendship>(userId)?.data : undefined),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function usePendingFriendRequestsQuery(userId: string | undefined) {
  return useQuery<any[]>({
    queryKey: pendingFriendsQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getPendingRequests(userId);
      if (error) throw error;
      const pending = (data ?? []) as any[];
      saveCachedPending(userId, pending);
      return pending;
    },
    initialData: () => (userId ? loadCachedPending<any>(userId)?.data : undefined),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}
