import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDmMessages,
  getDmThreads,
  getUnreadDmCount,
  sendDm,
  type DmMessage,
  type DmThread,
} from '../../../services/messaging';

// Push + fetch-on-focus; no realtime, no persistent cache (ephemeral chat).
export const dmThreadsQueryKey = (userId: string | undefined) =>
  ['dm-threads', userId ?? null] as const;
export const dmMessagesQueryKey = (threadId: number | undefined) =>
  ['dm-messages', threadId ?? null] as const;
export const unreadDmCountQueryKey = (userId: string | undefined) =>
  ['dm-unread', userId ?? null] as const;

export function useDmThreadsQuery(userId: string | undefined) {
  return useQuery<DmThread[]>({
    queryKey: dmThreadsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getDmThreads();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDmMessagesQuery(threadId: number | undefined) {
  return useQuery<DmMessage[]>({
    queryKey: dmMessagesQueryKey(threadId),
    queryFn: async () => {
      if (!threadId) return [];
      const { data, error } = await getDmMessages(threadId);
      if (error) throw error;
      return data;
    },
    enabled: !!threadId,
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useUnreadDmCountQuery(userId: string | undefined) {
  return useQuery<number>({
    queryKey: unreadDmCountQueryKey(userId),
    queryFn: async () => {
      const { data } = await getUnreadDmCount();
      return data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useSendDmMutation(threadId: number | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!threadId) throw new Error('no thread');
      const { data, error } = await sendDm(threadId, body);
      if (error) throw error;
      return data as number | null;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: dmMessagesQueryKey(threadId) });
      qc.invalidateQueries({ queryKey: dmThreadsQueryKey(userId) });
      qc.invalidateQueries({ queryKey: unreadDmCountQueryKey(userId) });
    },
  });
}
