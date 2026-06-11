import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFavorite, getFavorites, removeFavorite } from '../../services/favorites';
import { loadCachedFavorites, saveCachedFavorites } from '../../lib/favoritesCache';
import { useOfflineQueue } from '../../contexts/OfflineQueueProvider';

export const favoritesQueryKey = (userId: string | undefined) => ['favorites', userId] as const;

export function useFavoritesQuery(userId: string | undefined) {
  return useQuery<any[]>({
    queryKey: favoritesQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getFavorites(userId);
      if (error) throw error;
      const favorites = (data ?? []) as any[];
      // Mirror to the domain cache (blessed useLeaderboardQuery pattern,
      // T050/T055) — the cache was previously write-only on the
      // invalidate side with load/save never called.
      saveCachedFavorites(userId, favorites);
      return favorites;
    },
    initialData: () => (userId ? loadCachedFavorites<any>(userId)?.data : undefined),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useToggleFavoriteMutation(userId: string | undefined) {
  const qc = useQueryClient();
  const { isOnline, enqueue } = useOfflineQueue();

  // Replay of queued toggles is handled by the module-level 'favorite'
  // handler in lib/offlineHandlers — it exists regardless of mounted
  // screens, so a toggle queued here replays even after navigating away.
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
