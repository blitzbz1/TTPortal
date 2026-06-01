import { useQuery } from '@tanstack/react-query';
import { getProfile, getProfileStats } from '../../services/profiles';

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;
export const profileStatsQueryKey = (userId: string | undefined) =>
  ['profile-stats', userId] as const;

export function useProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await getProfile(userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProfileStatsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: profileStatsQueryKey(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await getProfileStats(userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
