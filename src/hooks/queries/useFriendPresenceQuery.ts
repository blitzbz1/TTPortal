import { useQuery } from '@tanstack/react-query';
import { getFriendIds } from '../../services/friends';
import { getActiveFriendCheckins } from '../../services/checkins';
import { getActiveFriendEvents } from '../../services/events';

export interface FriendPresence {
  venueIds: Set<number>;
  uniqueFriends: number;
}

export const friendPresenceQueryKey = (userId: string | undefined) =>
  ['friend-presence', userId ?? 'anon'] as const;

/**
 * Friend overlay used by the map: which venues currently have a friend
 * checked in or participating in an in-progress event, plus a unique
 * friend count for the header badge.
 *
 * Cached for 30s (staleTime). Active checkins and event participation
 * change slowly enough at this granularity that 30s feels live; tab
 * switches no longer refetch the same set repeatedly.
 */
export function useFriendPresenceQuery(userId: string | undefined) {
  return useQuery<FriendPresence>({
    queryKey: friendPresenceQueryKey(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return { venueIds: new Set<number>(), uniqueFriends: 0 };
      const fIds = await getFriendIds(userId);
      if (!fIds.length) return { venueIds: new Set<number>(), uniqueFriends: 0 };

      const [checkinsRes, eventsRes] = await Promise.all([
        getActiveFriendCheckins(fIds),
        getActiveFriendEvents(fIds),
      ]);

      const venueIds = new Set<number>();
      const uniqueFriends = new Set<string>();
      for (const c of (checkinsRes.data ?? []) as any[]) {
        if (typeof c.venue_id === 'number') venueIds.add(c.venue_id);
        if (typeof c.user_id === 'string') uniqueFriends.add(c.user_id);
      }
      for (const ev of eventsRes.data ?? []) {
        if (typeof ev.venue_id === 'number') venueIds.add(ev.venue_id);
        for (const p of ev.event_participants ?? []) {
          if (typeof p.user_id === 'string') uniqueFriends.add(p.user_id);
        }
      }
      return { venueIds, uniqueFriends: uniqueFriends.size };
    },
  });
}
