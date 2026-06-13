import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmMatch,
  disputeMatch,
  getPendingMatches,
  getPlayerMatches,
  logMatch,
  type LogMatchInput,
  type PendingMatch,
  type PlayerMatch,
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
    // Both the responder's pending list and either player's history change.
    onSettled: () => qc.invalidateQueries({ queryKey: ['matches'], exact: false }),
  });
}
