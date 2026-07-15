import { useQuery } from '@tanstack/react-query';
import { getCoachProfile } from '../../../services/coaches';
import {
  loadCachedCoachProfile,
  saveCachedCoachProfile,
} from '../../../lib/coachesCache';
import type { CoachProfile } from '../../../types/database';

export const coachProfileQueryKey = (userId: string | undefined) =>
  ['coach-profile', userId] as const;

/**
 * A user's coach_profile (F063). Public-read-when-approved: returns the approved
 * row for anyone (drives the pinned coach card on a player profile), or the
 * owner's own pending/rejected row (drives the application-status banner).
 * Blessed react-query shape: queryFn mirrors to the domain cache; initialData
 * hydrates from it.
 */
export function useCoachProfileQuery(userId: string | undefined) {
  return useQuery<CoachProfile | null>({
    queryKey: coachProfileQueryKey(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await getCoachProfile(userId);
      if (error) throw error;
      saveCachedCoachProfile(userId, data);
      return data;
    },
    initialData: () => (userId ? loadCachedCoachProfile<CoachProfile | null>(userId)?.data : undefined),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
