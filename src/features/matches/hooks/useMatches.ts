import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmMatch,
  disputeMatch,
  getHeadToHead,
  getPendingMatches,
  getPlayerMatches,
  getRivals,
  logMatch,
  type HeadToHead,
  type LogMatchInput,
  type PendingMatch,
  type PlayerMatch,
  type Rival,
} from '../../../services/matches';
import { loadCachedMatches, saveCachedMatches } from '../../../lib/matchesCache';

export const playerMatchesQueryKey = (userId: string | undefined) =>
  ['matches', userId ?? null] as const;
export const pendingMatchesQueryKey = (userId: string | undefined) =>
  ['matches', 'pending', userId ?? null] as const;

/** A user's match history (mirrors useLeaderboardQuery: cache-first + refetch). */
export function usePlayerMatchesQuery(userId: string | undefined) {
  return useQuery<PlayerMatch[]>({
    queryKey: playerMatchesQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getPlayerMatches(userId);
      if (error) throw error;
      saveCachedMatches(userId, data);
      return data;
    },
    initialData: () => (userId ? loadCachedMatches<PlayerMatch>(userId)?.data : undefined),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Matches awaiting the caller's confirmation — drives the inbox inline card. */
export function usePendingMatchesQuery(userId: string | undefined) {
  return useQuery<PendingMatch[]>({
    queryKey: pendingMatchesQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getPendingMatches();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

// F031: head-to-head record vs one opponent (viewer-relative, block-filtered).
export const headToHeadQueryKey = (userId: string | undefined, opponentId: string | undefined) =>
  ['head-to-head', userId ?? null, opponentId ?? null] as const;

export function useHeadToHeadQuery(userId: string | undefined, opponentId: string | undefined) {
  return useQuery<HeadToHead | null>({
    queryKey: headToHeadQueryKey(userId, opponentId),
    queryFn: async () => {
      if (!opponentId) return null;
      const { data, error } = await getHeadToHead(opponentId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!opponentId,
    staleTime: 5 * 60 * 1000,
  });
}

// F031: the viewer's most-played opponents.
export const rivalsQueryKey = (userId: string | undefined) => ['rivals', userId ?? null] as const;

export function useRivalsQuery(userId: string | undefined) {
  return useQuery<Rival[]>({
    queryKey: rivalsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getRivals();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogMatchMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogMatchInput) => {
      const { data, error } = await logMatch(input);
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      if (userId) qc.invalidateQueries({ queryKey: playerMatchesQueryKey(userId) });
    },
  });
}

export function useRespondToMatchMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, action }: { matchId: number; action: 'confirm' | 'dispute' }) => {
      const { data, error } = await (action === 'confirm'
        ? confirmMatch(matchId)
        : disputeMatch(matchId));
      if (error) throw error;
      return data;
    },
    // Both the responder's pending list and either player's history change;
    // a confirm also moves both players' ratings (F030 trigger).
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['matches'], exact: false });
      qc.invalidateQueries({ queryKey: ['rating'], exact: false });
    },
  });
}
