import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelPlayIntent,
  convertPlayIntentToEvent,
  getMyPlayIntent,
  getOpenPlayCounts,
  getVenueOpenPlay,
  joinPlayIntent,
  leavePlayIntent,
  type MyPlayIntent,
  type VenueOpenPlay,
} from '../../../services/openplay';

// Live, ephemeral data (like venueIntel live counts) — no persistent cache.
export const venueOpenPlayQueryKey = (venueId: number | undefined) =>
  ['venue-open-play', venueId ?? null] as const;
export const openPlayCountsQueryKey = (cityId: number | null | undefined) =>
  ['open-play-counts', cityId ?? null] as const;
export const myPlayIntentQueryKey = (userId: string | undefined) =>
  ['my-play-intent', userId ?? null] as const;

export function useVenueOpenPlayQuery(venueId: number | undefined) {
  return useQuery<VenueOpenPlay[]>({
    queryKey: venueOpenPlayQueryKey(venueId),
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await getVenueOpenPlay(venueId);
      if (error) throw error;
      return data;
    },
    enabled: !!venueId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** Per-venue open-broadcast counts as a Map (mirrors useLiveVenueCountsQuery). */
export function useOpenPlayCountsQuery(cityId: number | null | undefined) {
  return useQuery<Map<number, number>>({
    queryKey: openPlayCountsQueryKey(cityId),
    queryFn: async () => {
      const { data } = await getOpenPlayCounts(cityId ?? null);
      return data; // never throws — empty map on failure (live overlay)
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useMyPlayIntentQuery(userId: string | undefined) {
  return useQuery<MyPlayIntent | null>({
    queryKey: myPlayIntentQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getMyPlayIntent();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** Invalidate every open-play surface after a write (join/leave/create/convert). */
export function useInvalidateOpenPlay() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['venue-open-play'], exact: false });
    qc.invalidateQueries({ queryKey: ['open-play-counts'], exact: false });
    qc.invalidateQueries({ queryKey: ['my-play-intent'], exact: false });
  };
}

export function useRespondToOpenPlayMutation() {
  const invalidate = useInvalidateOpenPlay();
  return useMutation({
    mutationFn: async ({ intentId, action }: { intentId: number; action: 'join' | 'leave' }) => {
      const { data, error } = await (action === 'join'
        ? joinPlayIntent(intentId)
        : leavePlayIntent(intentId));
      if (error) throw error;
      return data as number | null;
    },
    onSettled: invalidate,
  });
}

export function useCancelPlayIntentMutation() {
  const invalidate = useInvalidateOpenPlay();
  return useMutation({
    mutationFn: async (intentId: number) => {
      const { error } = await cancelPlayIntent(intentId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useConvertPlayIntentMutation() {
  const invalidate = useInvalidateOpenPlay();
  return useMutation({
    mutationFn: async ({ intentId, title }: { intentId: number; title?: string | null }) => {
      const { data, error } = await convertPlayIntentToEvent(intentId, title);
      if (error) throw error;
      return data as number | null;
    },
    onSettled: invalidate,
  });
}
