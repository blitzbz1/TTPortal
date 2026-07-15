import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  loadCachedVenueMeta,
  loadCachedVenueReviews,
  saveCachedVenueMeta,
  saveCachedVenueReviews,
} from '../../lib/venueDetailCache';
export interface VenuePlayerMix {
  total: number;
  breakdown: Record<string, number>;
  top: string;
}

export interface VenueDetailBundle {
  venue: any;
  stats: any | null;
  is_favorited: boolean;
  user_active_checkin: any | null;
  upcoming_event_count: number;
  champion: { user_id: string; full_name: string | null; day_count: number } | null;
  recent_reviews: any[];
  /** F001: anonymized skill-mix label; present only at >= 5 recent levellers. */
  player_mix?: VenuePlayerMix | null;
  /**
   * F010/F011/F012/F014 venue-intelligence (busyness, free-tables, amenities,
   * regulars) are NOT in this bundle — they load via the separate, fully
   * isolated useVenueIntelQuery so they can never affect the core venue load.
   */
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
      // The player-mix (F001) is a separate lightweight RPC kept off the main
      // bundle; it must never fail the detail load. The Phase-2 venue
      // intelligence (busyness/free-tables/amenities/regulars) lives in a
      // SEPARATE query (useVenueIntelQuery) so it is structurally incapable of
      // affecting this critical path — the screen depends ONLY on get_venue_detail.
      const [detailRes, mixRes] = await Promise.all([
        supabase.rpc('get_venue_detail', { p_venue_id: venueId, p_review_limit: 5 }),
        // get_venue_player_mix (104) isn't in the generated RPC types yet.
        (supabase.rpc as any)('get_venue_player_mix', { p_venue_id: venueId }),
      ]);
      const { data, error } = detailRes;
      const playerMix: VenuePlayerMix | null =
        mixRes && !mixRes.error ? ((mixRes.data as VenuePlayerMix | null) ?? null) : null;

      if (!error) {
        const bundle = (data as VenueDetailBundle | null) ?? null;
        if (bundle) {
          if (bundle.venue) {
            // Mirror the slow-changing parts into the SQLite cache so the
            // screen still renders offline.
            saveCachedVenueMeta(venueId, { venue: bundle.venue, stats: bundle.stats ?? null });
            saveCachedVenueReviews(venueId, bundle.recent_reviews ?? []);
          }
          bundle.player_mix = playerMix;
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
