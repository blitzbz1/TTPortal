import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  findPlayers,
  getPartnerPreferences,
  sendMatchInvite,
  setDiscoverable,
  setPartnerPreferences,
  type FindPlayer,
  type FindPlayersFilters,
  type PartnerPreferences,
  type SoughtStyle,
} from '../../../services/findPlayers';

export const findPlayersQueryKey = (
  userId: string | undefined,
  filters: FindPlayersFilters,
) => ['find-players', userId ?? null, filters.city ?? null, filters.skill ?? null, filters.style ?? null] as const;

export const partnerPrefsQueryKey = (userId: string | undefined) =>
  ['partner-prefs', userId ?? null] as const;

/** The opt-in city directory. `enabled` gates the network call on being discoverable. */
export function useFindPlayersQuery(
  userId: string | undefined,
  filters: FindPlayersFilters,
  enabled: boolean,
) {
  return useQuery<FindPlayer[]>({
    queryKey: findPlayersQueryKey(userId, filters),
    queryFn: async () => {
      const { data, error } = await findPlayers(filters);
      if (error) throw error;
      return data;
    },
    enabled: !!userId && enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function usePartnerPreferencesQuery(userId: string | undefined) {
  return useQuery<PartnerPreferences | null>({
    queryKey: partnerPrefsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getPartnerPreferences();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useSetDiscoverableMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await setDiscoverable(value);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: partnerPrefsQueryKey(userId) });
      qc.invalidateQueries({ queryKey: ['find-players'], exact: false });
    },
  });
}

export function useSetPartnerPreferencesMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { soughtStyles?: SoughtStyle[]; availability?: string[]; note?: string | null }) => {
      const { error } = await setPartnerPreferences(input);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: partnerPrefsQueryKey(userId) }),
  });
}

export function useSendMatchInviteMutation() {
  return useMutation({
    mutationFn: async ({ inviteeId, venueId, note }: { inviteeId: string; venueId?: number | null; note?: string | null }) => {
      const { data, error } = await sendMatchInvite(inviteeId, venueId, note);
      if (error) throw error;
      return data as number | null;
    },
  });
}
