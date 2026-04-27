import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFavorite, getFavorites, removeFavorite } from '../../services/favorites';
import { useOfflineQueue } from '../../contexts/OfflineQueueProvider';

export const favoritesQueryKey = (userId: string | undefined) => ['favorites', userId] as const;

export function useFavoritesQuery(userId: string | undefined) {
  return useQuery<any[]>({
    queryKey: favoritesQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getFavorites(userId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useToggleFavoriteMutation(userId: string | undefined) {
  const qc = useQueryClient();
  const { isOnline, enqueue, registerHandler } = useOfflineQueue();

  useEffect(() => {
    return registerHandler('favorite', async (change) => {
      const payload = change.payload as { userId: string; venueId: number; operation: 'add' | 'remove' };
      const result =
        payload.operation === 'remove'
          ? await removeFavorite(payload.userId, payload.venueId)
          : await addFavorite(payload.userId, payload.venueId);
      if (result.error) return { error: result.error };
      qc.invalidateQueries({ queryKey: favoritesQueryKey(payload.userId) });
    });
  }, [qc, registerHandler]);

  return useMutation({
    mutationFn: async ({ venueId, isFav }: { venueId: number; isFav: boolean }) => {
      if (!userId) throw new Error('not signed in');
      if (!isOnline) {
        enqueue({
          entityType: 'favorite',
          entityId: `${userId}:${venueId}`,
          operation: isFav ? 'delete' : 'create',
          payload: { userId, venueId, operation: isFav ? 'remove' : 'add' },
        });
        return { venueId, isFav: !isFav, queued: true };
      }
      const result = isFav ? await removeFavorite(userId, venueId) : await addFavorite(userId, venueId);
      if (result.error) throw result.error;
      return { venueId, isFav: !isFav, queued: false };
    },
    onMutate: async ({ venueId, isFav }) => {
      await qc.cancelQueries({ queryKey: favoritesQueryKey(userId) });
      const prev = qc.getQueryData<any[]>(favoritesQueryKey(userId)) ?? [];
      qc.setQueryData<any[]>(favoritesQueryKey(userId), (old) => {
        const list = old ?? [];
        if (isFav) return list.filter((f) => f.venue_id !== venueId);
        return [...list, { venue_id: venueId, user_id: userId }];
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(favoritesQueryKey(userId), ctx.prev);
    },
    onSettled: (data) => {
      if (!data?.queued) {
        qc.invalidateQueries({ queryKey: favoritesQueryKey(userId) });
      }
    },
  });
}
