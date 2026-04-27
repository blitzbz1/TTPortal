import { useQuery } from '@tanstack/react-query';
import { getProfile } from '../../services/profiles';

// is_admin is set server-side and effectively never changes during a session.
// Cached infinitely so it's fetched at most once per signed-in user across
// every screen that needs to gate admin-only UI.
export const isAdminQueryKey = (userId: string | undefined) => ['is-admin', userId] as const;

export function useIsAdminQuery(userId: string | undefined) {
  return useQuery<boolean>({
    queryKey: isAdminQueryKey(userId),
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await getProfile(userId);
      return data?.is_admin === true;
    },
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
