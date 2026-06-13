import type { PostgrestError } from '@supabase/supabase-js';
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

export async function getFriendFeed(limit = 30): Promise<{ data: FeedItem[]; error: PostgrestError | null }> {
  // Single RPC (migrations 052/083) returns the merged-and-sorted top-N feed.
  // The server derives the caller's accepted friendships from auth.uid() —
  // clients no longer pass friend IDs.
  const { data, error } = await supabase.rpc('get_friend_feed', {
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
