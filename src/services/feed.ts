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

export async function getFriendFeed(friendIds: string[], limit = 30): Promise<{ data: FeedItem[]; error: any }> {
  if (!friendIds.length) return { data: [], error: null };

  const [checkinsRes, reviewsRes] = await Promise.all([
    supabase
      .from('checkins')
      .select('id, user_id, venue_id, started_at, venues(name, city), profiles(full_name)')
      .in('user_id', friendIds)
      .order('started_at', { ascending: false })
      .limit(limit),
    supabase
      .from('reviews')
      .select('id, user_id, venue_id, rating, created_at, reviewer_name, venues(name)')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const items: FeedItem[] = [];

  for (const c of (checkinsRes.data ?? [])) {
    items.push({
      id: `checkin-${c.id}`,
      type: 'checkin',
      userId: c.user_id,
      userName: (c as any).profiles?.full_name ?? '?',
      venueName: (c as any).venues?.name ?? '?',
      venueId: c.venue_id,
      venueCity: (c as any).venues?.city ?? '',
      timestamp: c.started_at,
    });
  }

  for (const r of (reviewsRes.data ?? [])) {
    items.push({
      id: `review-${r.id}`,
      type: 'review',
      userId: r.user_id,
      userName: r.reviewer_name ?? '?',
      venueName: (r as any).venues?.name ?? '?',
      venueId: r.venue_id,
      rating: r.rating,
      timestamp: r.created_at,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { data: items.slice(0, limit), error: checkinsRes.error || reviewsRes.error };
}
