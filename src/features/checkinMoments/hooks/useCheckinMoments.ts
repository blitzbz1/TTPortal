import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getVenueMoments,
  postCheckinMoment,
  deleteCheckinMoment,
  type VenueMoment,
} from '../../../services/checkinMoments';
import {
  loadCachedCheckinMoments,
  saveCachedCheckinMoments,
} from '../../../lib/checkinMomentsCache';

export const venueMomentsQueryKey = (venueId: number | undefined, currentUserId?: string) =>
  ['checkin-moments', venueId ?? null, currentUserId ?? null] as const;

/**
 * A venue's recent moments (cache-first + refetch — useLeaderboardQuery shape).
 * Gated on an authenticated user: get_venue_moments is GRANTed to authenticated
 * only, and the venue route is reachable signed-out, so without this an anon
 * viewer fires failing RPC round-trips (and a brief loading flash).
 */
export function useVenueMomentsQuery(venueId: number | undefined, currentUserId?: string) {
  return useQuery<VenueMoment[]>({
    queryKey: venueMomentsQueryKey(venueId, currentUserId),
    enabled: !!currentUserId && venueId != null && venueId > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (venueId == null) return [];
      const { data, error } = await getVenueMoments(venueId);
      if (error) throw error;
      if (currentUserId) saveCachedCheckinMoments(venueId, currentUserId, data);
      return data;
    },
    initialData: () => (venueId != null && currentUserId ? loadCachedCheckinMoments<VenueMoment>(venueId, currentUserId)?.data : undefined),
  });
}

export function usePostMomentMutation(venueId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checkinId,
      photoUrl,
      caption,
    }: {
      checkinId: number;
      photoUrl: string;
      caption?: string | null;
    }) => {
      const { data, error } = await postCheckinMoment(checkinId, venueId!, photoUrl, caption ?? null);
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      if (venueId != null) qc.invalidateQueries({ queryKey: ['checkin-moments', venueId] });
    },
  });
}

export function useDeleteMomentMutation(venueId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (momentId: number) => {
      const { error } = await deleteCheckinMoment(momentId);
      if (error) throw error;
    },
    onSettled: () => {
      if (venueId != null) qc.invalidateQueries({ queryKey: ['checkin-moments', venueId] });
    },
  });
}
