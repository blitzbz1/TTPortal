import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface FriendAtVenue {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  source: 'checkin' | 'event';
  event_title: string | null;
}

export const friendsAtVenueQueryKey = (venueId: number, userId: string | undefined) =>
  ['friends-at-venue', venueId, userId ?? null] as const;

export function useFriendsAtVenueQuery(venueId: number | undefined, userId: string | undefined) {
  return useQuery<FriendAtVenue[]>({
    queryKey: friendsAtVenueQueryKey(venueId ?? 0, userId),
    queryFn: async () => {
      if (!venueId || !userId) return [];
      // Friendships are derived from auth.uid() server-side (migration 083);
      // userId stays in the query key only for account-switch correctness.
      const { data, error } = await supabase.rpc('get_friends_at_venue', {
        p_venue_id: venueId,
      });
      if (error) throw error;
      return (data as FriendAtVenue[]) ?? [];
    },
    enabled: !!venueId && !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
