import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { SkillLevel } from '../lib/playerAttributes';

// F022 RPCs (get_crossed_paths / dismiss_crossed_path, migration 117) are not
// in the generated Database type yet → bound shim (the `.bind(supabase)` is
// load-bearing; see services/__tests__/rpcBinding.test.ts).
type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

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

// --- F022: Crossed Paths ---------------------------------------------------

export interface CrossedPath {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  username: string | null;
  skillLevel: SkillLevel | null;
  venueId: number | null;
  venueName: string | null;
  sharedCount: number;
  lastCrossedAt: string;
}

interface CrossedPathRpcRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  username: string | null;
  skill_level: SkillLevel | null;
  venue_id: number | null;
  venue_name: string | null;
  shared_count: number;
  last_crossed_at: string;
}

/**
 * Non-friend players whose recent check-ins overlapped the caller's at the same
 * venue (migration 117). The server derives the caller from auth.uid() and
 * excludes friends + blocked + already-dismissed users.
 */
export async function getCrossedPaths(): Promise<{ data: CrossedPath[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_crossed_paths', {});
  if (error || !data) return { data: [], error };
  const items: CrossedPath[] = (data as CrossedPathRpcRow[]).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name ?? '',
    avatarUrl: row.avatar_url ?? null,
    city: row.city ?? null,
    username: row.username ?? null,
    skillLevel: row.skill_level ?? null,
    venueId: row.venue_id ?? null,
    venueName: row.venue_name ?? null,
    sharedCount: row.shared_count,
    lastCrossedAt: row.last_crossed_at,
  }));
  return { data: items, error: null };
}

/** Hide a crossed-paths suggestion for the caller (idempotent). */
export async function dismissCrossedPath(dismissedUserId: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await callRpc('dismiss_crossed_path', { p_user_id: dismissedUserId });
  return { error };
}
