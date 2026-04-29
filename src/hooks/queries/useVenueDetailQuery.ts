import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface VenueDetailBundle {
  venue: any;
  stats: any | null;
  is_favorited: boolean;
  user_active_checkin: any | null;
  upcoming_event_count: number;
  champion: { user_id: string; full_name: string | null; day_count: number } | null;
  recent_reviews: any[];
}

export const venueDetailQueryKey = (venueId: number, userId: string | undefined) =>
  ['venue-detail', venueId, userId ?? null] as const;

export function useVenueDetailQuery(venueId: number | undefined, userId: string | undefined) {
  return useQuery<VenueDetailBundle | null>({
    queryKey: venueDetailQueryKey(venueId ?? 0, userId),
    queryFn: async () => {
      if (!venueId) return null;
      const { data, error } = await supabase.rpc('get_venue_detail', {
        p_venue_id: venueId,
        p_user_id: userId ?? null,
        p_review_limit: 5,
      });
      if (error) throw error;
      return (data as VenueDetailBundle | null) ?? null;
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
