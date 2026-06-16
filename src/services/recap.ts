// F052: weekly recap service. Thin wrapper over the SECURITY DEFINER RPC in
// migration 128 (not in the generated types yet → bound callRpc shim; the
// `.bind(supabase)` is load-bearing, see leaderboard.ts / ratings.ts /
// rpcBinding.test.ts).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

/** One week's recap, aggregated over checkins + event hours + streaks. */
export interface WeeklyRecap {
  sessions: number;
  hours: number;
  venues: number;
  /** Of `venues`, how many the user visited for the first time this week. */
  new_venues: number;
  friends_played_with: number;
  /** Position in the week's global checkin leaderboard; null if no checkins. */
  rank: number | null;
  /** Positive = climbed vs last week; null when there's no comparison. */
  rank_delta: number | null;
  current_streak: number;
}

/**
 * The caller's weekly recap. `weekStart` is an ISO date string (YYYY-MM-DD) for
 * the Monday of the target week; omit it to default to the current week
 * (the RPC defaults to date_trunc('week', now())).
 */
export async function getWeeklyRecap(
  userId: string,
  weekStart?: string | null,
): Promise<{ data: WeeklyRecap | null; error: PostgrestError | null }> {
  const params: Record<string, unknown> = { p_user_id: userId };
  if (weekStart) params.p_week_start = weekStart;
  const { data, error } = await callRpc('get_weekly_recap', params);
  if (error) return { data: null, error };
  // The RPC returns a TABLE (one row) → an array with a single element.
  const row = (Array.isArray(data) ? data[0] : data) as WeeklyRecap | undefined | null;
  if (!row) return { data: null, error: null };
  return {
    data: {
      sessions: row.sessions ?? 0,
      hours: Number(row.hours ?? 0),
      venues: row.venues ?? 0,
      new_venues: row.new_venues ?? 0,
      friends_played_with: row.friends_played_with ?? 0,
      rank: row.rank ?? null,
      rank_delta: row.rank_delta ?? null,
      current_streak: row.current_streak ?? 0,
    },
    error: null,
  };
}

/** Monday (ISO week start) for the week that just ended, as a YYYY-MM-DD string. */
export function lastWeekStartIso(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: 0=Sun..6=Sat. ISO Monday = day 1. Days since Monday:
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday - 7); // back to the prior Monday
  return d.toISOString().slice(0, 10);
}
