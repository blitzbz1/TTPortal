// F002: match recording service. Thin wrappers over the SECURITY DEFINER RPCs
// in migration 105. These RPCs aren't in the generated supabase types yet, so
// the rpc name is cast.
import { supabase } from '../lib/supabase';

export type MatchStatus = 'pending' | 'confirmed' | 'disputed' | 'void';

/** One game within a match: `a` = reporter's points, `b` = opponent's. */
export interface MatchSet {
  a: number;
  b: number;
}

export interface PlayerMatch {
  id: number;
  reporter_id: string;
  opponent_id: string;
  winner_id: string | null;
  sets: MatchSet[];
  venue_id: number | null;
  event_id: number | null;
  status: MatchStatus;
  created_at: string;
  confirmed_at: string | null;
  reporter_name: string | null;
  opponent_name: string | null;
}

export interface PendingMatch {
  id: number;
  reporter_id: string;
  opponent_id: string;
  winner_id: string | null;
  sets: MatchSet[];
  created_at: string;
  reporter_name: string | null;
}

export interface LogMatchInput {
  opponentId: string;
  sets: MatchSet[];
  winnerId: string | null;
  venueId?: number | null;
  eventId?: number | null;
  note?: string | null;
}

// Match RPCs (migration 105) aren't in the generated supabase types yet; this
// typed shim avoids `any` until the types are regenerated after 105 applies.
type RpcResponse<T> = Promise<{ data: T | null; error: unknown }>;
const callRpc = supabase.rpc as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export async function logMatch(input: LogMatchInput) {
  return callRpc('log_match', {
    p_opponent_id: input.opponentId,
    p_sets: input.sets,
    p_winner_id: input.winnerId,
    p_venue_id: input.venueId ?? null,
    p_event_id: input.eventId ?? null,
    p_note: input.note ?? null,
  });
}

export async function confirmMatch(matchId: number) {
  return callRpc('confirm_match', { p_match_id: matchId });
}

export async function disputeMatch(matchId: number) {
  return callRpc('dispute_match', { p_match_id: matchId });
}

export async function getPlayerMatches(
  userId: string,
  limit = 50,
): Promise<{ data: PlayerMatch[]; error: unknown }> {
  const { data, error } = await callRpc('get_player_matches', {
    p_user_id: userId,
    p_limit: limit,
  });
  return { data: (data ?? []) as PlayerMatch[], error };
}

export async function getPendingMatches(): Promise<{ data: PendingMatch[]; error: unknown }> {
  const { data, error } = await callRpc('get_pending_matches');
  return { data: (data ?? []) as PendingMatch[], error };
}

/** W/L/pending tally for a user over their confirmed matches. */
export function summarizeMatches(matches: PlayerMatch[], userId: string) {
  let wins = 0;
  let losses = 0;
  for (const m of matches) {
    if (m.status !== 'confirmed' || !m.winner_id) continue;
    if (m.winner_id === userId) wins += 1;
    else losses += 1;
  }
  return { wins, losses, total: wins + losses };
}
