// F030: Elo rating service. Thin wrapper over the SECURITY DEFINER RPC in
// migration 119 (not in generated types → bound callRpc shim; the
// `.bind(supabase)` is load-bearing, see __tests__/rpcBinding.test.ts).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export interface PlayerRating {
  rating: number;
  peak: number;
  matches: number;
  provisional: boolean;
  /** Rating values over the last 90 days, oldest → newest (sparkline). */
  spark: number[];
  /** Last up-to-5 deltas, most recent first. */
  last5: number[];
}

interface RatingRpc {
  rating: number; peak: number; matches: number; provisional: boolean;
  spark: number[] | null; last5: number[] | null;
}

export async function getPlayerRating(
  userId: string,
): Promise<{ data: PlayerRating | null; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_player_rating', { p_user_id: userId });
  if (error || !data) return { data: null, error };
  const r = data as RatingRpc;
  return {
    data: {
      rating: r.rating,
      peak: r.peak,
      matches: r.matches,
      provisional: r.provisional,
      spark: r.spark ?? [],
      last5: r.last5 ?? [],
    },
    error: null,
  };
}
