// F051: explorer-quests service. Thin wrappers over the SECURITY DEFINER RPCs
// in migration 127 (not in the generated types yet → bound callRpc shim; the
// `.bind(supabase)` is load-bearing, see referrals.ts / rpcBinding.test.ts).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export type ExplorerQuestPredicate = 'all' | 'park' | 'indoor' | 'verified';
export type ExplorerTier = 'bronze' | 'silver' | 'gold';

/** One quest's progress row from get_explorer_progress. */
export interface ExplorerProgress {
  key: string;
  predicate: ExplorerQuestPredicate;
  bronze: number;
  silver: number;
  gold: number;
  city_scoped: boolean;
  sort: number;
  /** Distinct venues the caller has visited matching the predicate (city-filtered when scoped). */
  progress: number;
  earned_bronze: boolean;
  earned_silver: boolean;
  earned_gold: boolean;
}

/**
 * The caller's explorer-quest progress, one row per quest. When `city` is
 * passed, the `progress` count for city-scoped quests is limited to that city
 * (earned tiers remain lifetime/global).
 */
export async function getExplorerProgress(
  city?: string | null,
): Promise<{ data: ExplorerProgress[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_explorer_progress', { p_city: city ?? null });
  const rows = (Array.isArray(data) ? data : []) as ExplorerProgress[];
  return { data: rows, error };
}

/**
 * The ids of approved venues in `city` the caller has NOT checked into — the
 * "new to you" set for the map pins. Returns a plain number[] (the hook builds
 * the Set).
 */
export async function getUnvisitedVenueIds(
  city: string,
): Promise<{ data: number[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_unvisited_venue_ids', { p_city: city });
  const rows = (Array.isArray(data) ? data : []) as { venue_id: number }[];
  return { data: rows.map((r) => r.venue_id), error };
}
