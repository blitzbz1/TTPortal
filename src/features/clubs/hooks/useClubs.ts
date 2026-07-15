import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createClub,
  joinClubByCode,
  getMyClubs,
  getClubDetail,
  leaveClub,
  removeClubMember,
  rotateClubJoinCode,
  type ClubDetail,
  type CreateClubInput,
  type MyClub,
} from '../../../services/clubs';
import { loadCachedClubs, saveCachedClubs } from '../../../lib/clubsCache';

export const myClubsQueryKey = (userId: string | undefined) =>
  ['clubs', userId ?? null] as const;
export const clubDetailQueryKey = (clubId: number | undefined) =>
  ['clubs', 'detail', clubId ?? null] as const;

/** The caller's clubs (mirrors useLeaderboardQuery: cache-first + refetch). */
export function useMyClubsQuery(userId: string | undefined) {
  return useQuery<MyClub[]>({
    queryKey: myClubsQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getMyClubs();
      if (error) throw error;
      saveCachedClubs(userId, data);
      return data;
    },
    initialData: () => (userId ? loadCachedClubs<MyClub>(userId)?.data : undefined),
    enabled: !!userId,
    // Membership can change on another device. Cached rows are only an
    // instant/offline paint; verify them whenever this screen mounts or the
    // browser regains focus so a cached empty list cannot hide a real join.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/** A single club's full detail (members + upcoming events). Ephemeral. */
export function useClubDetailQuery(clubId: number | undefined) {
  return useQuery<ClubDetail | null>({
    queryKey: clubDetailQueryKey(clubId),
    queryFn: async () => {
      if (!clubId) return null;
      const { data, error } = await getClubDetail(clubId);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
    staleTime: 60 * 1000,
  });
}

/** Invalidate every clubs query (list + details) after a mutation. */
export function useInvalidateClubs() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['clubs'], exact: false });
  };
}

export function useCreateClub() {
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: async (input: CreateClubInput) => {
      const { data, error } = await createClub(input);
      if (error) throw error;
      return data as number;
    },
    onSettled: invalidate,
  });
}

export function useJoinClub() {
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await joinClubByCode(code);
      if (error) throw error;
      return data as number;
    },
    onSettled: invalidate,
  });
}

export function useLeaveClub() {
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: async (clubId: number) => {
      const { error } = await leaveClub(clubId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useRemoveMember() {
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: async ({ clubId, userId }: { clubId: number; userId: string }) => {
      const { error } = await removeClubMember(clubId, userId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

export function useRotateCode() {
  const invalidate = useInvalidateClubs();
  return useMutation({
    mutationFn: async (clubId: number) => {
      const { data, error } = await rotateClubJoinCode(clubId);
      if (error) throw error;
      return data as string;
    },
    onSettled: invalidate,
  });
}
