import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  loadCachedVenueMeta,
  loadCachedVenueReviews,
  saveCachedVenueMeta,
  saveCachedVenueReviews,
} from '../../lib/venueDetailCache';
import type { VenueBusyness, VenueFreeTables, VenueRegulars } from '../../services/venueIntel';
import {
  getVenueBusyness,
  getVenueFreeTables,
  getVenueAmenities,
  getVenueRegulars,
} from '../../services/venueIntel';
import type { VenueAmenities } from '../../lib/amenities';

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
  /** F010: live count + typical-hours histogram (separate lightweight RPC). */
  venue_busyness?: VenueBusyness | null;
  /** F011: latest fresh free-table report (anonymous; decays ~90 min). */
  free_tables?: VenueFreeTables | null;
  /** F012: structured amenities/fees/access (separate lightweight RPC). */
  amenities?: VenueAmenities | null;
  /** F014: opt-in regulars (count + capped avatar list). */
  regulars?: VenueRegulars | null;
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
      // The player-mix (F001) and busyness (F010) are separate lightweight
      // RPCs kept off the main bundle; they must never fail the detail load.
      // F010/F011/F012/F014 ride alongside the bundle as separate lightweight
      // RPCs. They are FULLY ISOLATED: `safe()` swallows any rejection OR
      // synchronous throw so a problem in a secondary RPC can never reject the
      // Promise.all and fail the core venue load — the detail screen depends
      // ONLY on get_venue_detail. player_mix (F001) stays an inline rpc.
      const safe = async <T,>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T | null> => {
        try {
          const r = await fn();
          return r && !r.error ? (r.data ?? null) : null;
        } catch {
          return null;
        }
      };
      const [detailRes, mixRes, busyness, freeTables, amenities, regulars] = await Promise.all([
        supabase.rpc('get_venue_detail', { p_venue_id: venueId, p_review_limit: 5 }),
        safe(() => (supabase.rpc as any)('get_venue_player_mix', { p_venue_id: venueId })),
        safe(() => getVenueBusyness(venueId)),
        safe(() => getVenueFreeTables(venueId)),
        safe(() => getVenueAmenities(venueId)),
        safe(() => getVenueRegulars(venueId)),
      ]);
      const { data, error } = detailRes;
      const playerMix = mixRes as VenuePlayerMix | null;

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
          bundle.venue_busyness = busyness;
          bundle.free_tables = freeTables;
          bundle.amenities = amenities;
          bundle.regulars = regulars;
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
