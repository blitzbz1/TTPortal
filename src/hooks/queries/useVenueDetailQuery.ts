import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  loadCachedVenueMeta,
  loadCachedVenueReviews,
  saveCachedVenueMeta,
  saveCachedVenueReviews,
} from '../../lib/venueDetailCache';

export interface VenueDetailBundle {
  venue: any;
  stats: any | null;
  is_favorited: boolean;
  user_active_checkin: any | null;
  upcoming_event_count: number;
  champion: { user_id: string; full_name: string | null; day_count: number } | null;
  recent_reviews: any[];
  /**
   * True when the bundle was synthesized from the SQLite cache after the
   * RPC failed (offline). Personalized/live fields are absent; the screen
   * disables write actions.
   */
  fromCache?: boolean;
}

export const venueDetailQueryKey = (venueId: number, userId: string | undefined) =>
  ['venue-detail', venueId, userId ?? null] as const;

export function useVenueDetailQuery(venueId: number | undefined, userId: string | undefined) {
  return useQuery<VenueDetailBundle | null>({
    queryKey: venueDetailQueryKey(venueId ?? 0, userId),
    queryFn: async () => {
      if (!venueId) return null;
      // Personalized fields (is_favorited / user_active_checkin) are derived
      // from auth.uid() server-side (migration 083); userId stays in the
      // query key only so account switches don't serve a stale bundle.
      const { data, error } = await supabase.rpc('get_venue_detail', {
        p_venue_id: venueId,
        p_review_limit: 5,
      });

      if (!error) {
        const bundle = (data as VenueDetailBundle | null) ?? null;
        if (bundle?.venue) {
          // Mirror the slow-changing parts into the SQLite cache so the
          // screen still renders offline.
          saveCachedVenueMeta(venueId, { venue: bundle.venue, stats: bundle.stats ?? null });
          saveCachedVenueReviews(venueId, bundle.recent_reviews ?? []);
        }
        return bundle;
      }

      // RPC failed (typically offline): fall back to the cached meta +
      // reviews and synthesize a partial bundle. Live/personalized fields
      // are nulled; fromCache flags the screen to disable writes.
      const cachedMeta = loadCachedVenueMeta<{ venue: any; stats: any | null }>(venueId);
      if (cachedMeta) {
        const cachedReviews = loadCachedVenueReviews<any>(venueId);
        return {
          venue: cachedMeta.data.venue,
          stats: cachedMeta.data.stats,
          is_favorited: false,
          user_active_checkin: null,
          upcoming_event_count: 0,
          champion: null,
          recent_reviews: cachedReviews?.data ?? [],
          fromCache: true,
        };
      }

      throw error;
    },
    enabled: !!venueId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useInvalidateVenueDetail() {
  const qc = useQueryClient();
  return (venueId: number) =>
    qc.invalidateQueries({ queryKey: ['venue-detail', venueId], exact: false });
}
