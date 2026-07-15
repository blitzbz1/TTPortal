// F032: tournament bracket service. Thin wrappers over the SECURITY DEFINER
// RPCs in migration 121 (not in generated types → bound callRpc shim; the
// `.bind(supabase)` is load-bearing, see __tests__/rpcBinding.test.ts).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { MatchSet } from './matches';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export interface BracketSlot {
  slotId: number;
  round: number;
  position: number;
  playerA: string | null;
  playerAName: string | null;
  playerB: string | null;
  playerBName: string | null;
  winnerId: string | null;
  sets: MatchSet[];
}

export interface TournamentBracket {
  bracketId: number;
  size: number;
  status: 'active' | 'complete';
  championId: string | null;
  championName: string | null;
  slots: BracketSlot[];
}

interface BracketRpcRow {
  bracket_id: number; size: number; bracket_status: 'active' | 'complete';
  champion_id: string | null; champion_name: string | null;
  slot_id: number; round: number; slot_pos: number;
  player_a: string | null; player_a_name: string | null;
  player_b: string | null; player_b_name: string | null;
  winner_id: string | null; sets: MatchSet[] | null;
}

export function createBracket(eventId: number) {
  return callRpc('create_tournament_bracket', { p_event_id: eventId });
}

export function reportSlot(slotId: number, winnerId: string, sets: MatchSet[]) {
  return callRpc('report_tournament_slot', { p_slot_id: slotId, p_winner_id: winnerId, p_sets: sets });
}

export async function getBracket(eventId: number): Promise<{ data: TournamentBracket | null; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_tournament_bracket', { p_event_id: eventId });
  if (error || !data) return { data: null, error };
  const rows = data as BracketRpcRow[];
  if (!rows.length) return { data: null, error: null };
  const first = rows[0];
  const bracket: TournamentBracket = {
    bracketId: first.bracket_id,
    size: first.size,
    status: first.bracket_status,
    championId: first.champion_id,
    championName: first.champion_name,
    slots: rows.map((r) => ({
      slotId: r.slot_id, round: r.round, position: r.slot_pos,
      playerA: r.player_a, playerAName: r.player_a_name,
      playerB: r.player_b, playerBName: r.player_b_name,
      winnerId: r.winner_id, sets: r.sets ?? [],
    })),
  };
  return { data: bracket, error: null };
}
