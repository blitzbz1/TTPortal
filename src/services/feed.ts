import { supabase } from '../lib/supabase';

export interface FeedItem {
  id: string;
  type: 'checkin' | 'review';
  userId: string;
  userName: string;
  venueName: string;
  venueId: number;
  timestamp: string;
  rating?: number;
  venueCity?: string;
}

interface FeedRpcRow {
  kind: 'checkin' | 'review';
  id: number;
  user_id: string;
  user_name: string;
  venue_id: number;
  venue_name: string;
  venue_city: string;
  rating: number | null;
  ts: string;
}

export async function getFriendFeed(friendIds: string[], limit = 30): Promise<{ data: FeedItem[]; error: any }> {
  if (!friendIds.length) return { data: [], error: null };

  // Single RPC (migration 052) returns the merged-and-sorted top-N feed.
  // Replaces the previous two-query JS merge that hauled back up to 2×n
  // rows just to drop half of them.
  const { data, error } = await supabase.rpc('get_friend_feed', {
    p_friend_ids: friendIds,
    p_limit: limit,
  });
  if (error || !data) return { data: [], error };

  const items: FeedItem[] = (data as FeedRpcRow[]).map((row) => ({
    id: `${row.kind}-${row.id}`,
    type: row.kind,
    userId: row.user_id,
    userName: row.user_name,
    venueName: row.venue_name,
    venueId: row.venue_id,
    venueCity: row.venue_city || undefined,
    rating: row.rating ?? undefined,
    timestamp: row.ts,
  }));
  return { data: items, error: null };
}
