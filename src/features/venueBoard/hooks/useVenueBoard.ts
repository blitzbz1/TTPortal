import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getVenueBoard,
  postVenueMessage,
  togglePostHelpful,
  deleteVenuePost,
  type BoardPost,
} from '../../../services/venueBoard';
import { loadCachedVenueBoard, saveCachedVenueBoard } from '../../../lib/venueBoardCache';

export const venueBoardQueryKey = (venueId: number | undefined) =>
  ['venue-board', venueId ?? null] as const;

/** A venue's board (cache-first + refetch — useLeaderboardQuery shape). */
export function useVenueBoardQuery(venueId: number | undefined) {
  return useQuery<BoardPost[]>({
    queryKey: venueBoardQueryKey(venueId),
    enabled: venueId != null && venueId > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (venueId == null) return [];
      const { data, error } = await getVenueBoard(venueId);
      if (error) throw error;
      saveCachedVenueBoard(venueId, data);
      return data;
    },
    initialData: () => (venueId != null ? loadCachedVenueBoard<BoardPost>(venueId)?.data : undefined),
  });
}

export function usePostVenueMessageMutation(venueId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId?: number | null }) => {
      const { error } = await postVenueMessage(venueId!, body, parentId ?? null);
      if (error) throw error;
    },
    onSettled: () => {
      if (venueId != null) qc.invalidateQueries({ queryKey: venueBoardQueryKey(venueId) });
    },
  });
}

export function useTogglePostHelpfulMutation(venueId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => {
      const { error } = await togglePostHelpful(postId);
      if (error) throw error;
    },
    onSettled: () => {
      if (venueId != null) qc.invalidateQueries({ queryKey: venueBoardQueryKey(venueId) });
    },
  });
}

export function useDeleteVenuePostMutation(venueId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: number) => {
      const { error } = await deleteVenuePost(postId);
      if (error) throw error;
    },
    onSettled: () => {
      if (venueId != null) qc.invalidateQueries({ queryKey: venueBoardQueryKey(venueId) });
    },
  });
}
