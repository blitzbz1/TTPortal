import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBracket, getBracket, reportSlot, type TournamentBracket } from '../../../services/tournaments';
import type { MatchSet } from '../../../services/matches';

export const bracketQueryKey = (eventId: number | undefined) => ['tournament', eventId ?? null] as const;

export function useTournamentBracketQuery(eventId: number | undefined) {
  return useQuery<TournamentBracket | null>({
    queryKey: bracketQueryKey(eventId),
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await getBracket(eventId);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCreateBracketMutation(eventId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('no event');
      const { data, error } = await createBracket(eventId);
      if (error) throw error;
      return data as number | null;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: bracketQueryKey(eventId) }),
  });
}

export function useReportSlotMutation(eventId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slotId, winnerId, sets }: { slotId: number; winnerId: string; sets: MatchSet[] }) => {
      const { error } = await reportSlot(slotId, winnerId, sets);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bracketQueryKey(eventId) });
      // bracket games feed ratings/H2H
      qc.invalidateQueries({ queryKey: ['rating'], exact: false });
      qc.invalidateQueries({ queryKey: ['matches'], exact: false });
    },
  });
}
