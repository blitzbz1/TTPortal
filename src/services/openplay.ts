// F020: Open Play broadcast service. Thin wrappers over the SECURITY DEFINER
// RPCs in migration 115 (not in the generated types yet → bound callRpc shim;
// the `.bind(supabase)` is load-bearing, see __tests__/rpcBinding.test.ts).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { SkillLevel } from '../lib/playerAttributes';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export type WhenSlot = 'now' | 'plus_1h' | 'tonight' | 'tomorrow';

export interface VenueOpenPlay {
  id: number;
  hostId: string;
  hostName: string | null;
  hostAvatar: string | null;
  hostSkill: SkillLevel | null;
  whenSlot: WhenSlot;
  note: string | null;
  startsAt: string;
  joinCount: number;
  viewerJoined: boolean;
  isHost: boolean;
}

export interface MyPlayIntent {
  id: number;
  venueId: number;
  venueName: string | null;
  whenSlot: WhenSlot;
  note: string | null;
  visibility: 'friends_only' | 'public';
  startsAt: string;
  expiresAt: string;
  joinCount: number;
}

export interface CreatePlayIntentInput {
  venueId: number;
  whenSlot: WhenSlot;
  note?: string | null;
  isPublic?: boolean;
}

// --- writes ---------------------------------------------------------------
export function createPlayIntent(input: CreatePlayIntentInput) {
  return callRpc('create_play_intent', {
    p_venue_id: input.venueId,
    p_when_slot: input.whenSlot,
    p_note: input.note ?? null,
    p_public: input.isPublic ?? true,
  });
}

export function joinPlayIntent(intentId: number) {
  return callRpc('join_play_intent', { p_intent_id: intentId });
}

export function leavePlayIntent(intentId: number) {
  return callRpc('leave_play_intent', { p_intent_id: intentId });
}

export function cancelPlayIntent(intentId: number) {
  return callRpc('cancel_play_intent', { p_intent_id: intentId });
}

export function convertPlayIntentToEvent(intentId: number, title?: string | null) {
  return callRpc('convert_play_intent_to_event', { p_intent_id: intentId, p_title: title ?? null });
}

// --- reads ----------------------------------------------------------------
interface VenueOpenPlayRpcRow {
  id: number; host_id: string; host_name: string | null; host_avatar: string | null;
  host_skill: SkillLevel | null; when_slot: WhenSlot; note: string | null;
  starts_at: string; join_count: number; viewer_joined: boolean; is_host: boolean;
}

export async function getVenueOpenPlay(
  venueId: number,
): Promise<{ data: VenueOpenPlay[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_venue_open_play', { p_venue_id: venueId });
  if (error || !data) return { data: [], error };
  const items = (data as VenueOpenPlayRpcRow[]).map((r) => ({
    id: r.id, hostId: r.host_id, hostName: r.host_name, hostAvatar: r.host_avatar,
    hostSkill: r.host_skill, whenSlot: r.when_slot, note: r.note, startsAt: r.starts_at,
    joinCount: r.join_count, viewerJoined: r.viewer_joined, isHost: r.is_host,
  }));
  return { data: items, error: null };
}

/** Per-venue open-broadcast counts as a Map for O(1) marker lookup (mirrors getLiveVenueCounts). */
export async function getOpenPlayCounts(
  cityId: number | null,
): Promise<{ data: Map<number, number>; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_open_play_counts', { p_city_id: cityId });
  const map = new Map<number, number>();
  if (error || !data) return { data: map, error };
  for (const row of data as { venue_id: number; broadcast_count: number }[]) {
    map.set(row.venue_id, row.broadcast_count);
  }
  return { data: map, error: null };
}

interface MyIntentRpcRow {
  id: number; venue_id: number; venue_name: string | null; when_slot: WhenSlot;
  note: string | null; visibility: 'friends_only' | 'public';
  starts_at: string; expires_at: string; join_count: number;
}

export async function getMyPlayIntent(): Promise<{ data: MyPlayIntent | null; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_my_play_intent', {});
  if (error || !data) return { data: null, error };
  const rows = data as MyIntentRpcRow[];
  if (!rows.length) return { data: null, error: null };
  const r = rows[0];
  return {
    data: {
      id: r.id, venueId: r.venue_id, venueName: r.venue_name, whenSlot: r.when_slot,
      note: r.note, visibility: r.visibility, startsAt: r.starts_at, expiresAt: r.expires_at,
      joinCount: r.join_count,
    },
    error: null,
  };
}
