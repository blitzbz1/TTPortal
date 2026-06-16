// F021: Find Players directory + Challenge (match-invite) service. Thin wrappers
// over the SECURITY DEFINER RPCs in migration 116 (not in generated types →
// bound callRpc shim; see __tests__/rpcBinding.test.ts).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { DominantHand, Grip, PlayingStyle } from '../types/database';
import type { PlayGoal, SkillLevel } from '../lib/playerAttributes';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

/** A token a player is "sought" by: a playing style, penhold grip, or lefty. */
export type SoughtStyle = 'attacker' | 'defender' | 'all_rounder' | 'penholder' | 'lefty';

export interface FindPlayer {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  username: string | null;
  skillLevel: SkillLevel | null;
  playGoals: PlayGoal[];
  grip: Grip | null;
  playingStyle: PlayingStyle | null;
  dominantHand: DominantHand | null;
  playedThisWeek: boolean;
  availability: string[];
  prefNote: string | null;
}

export interface PendingMatchInvite {
  id: number;
  inviterId: string;
  inviterName: string | null;
  venueId: number | null;
  venueName: string | null;
  note: string | null;
  createdAt: string;
}

export interface PartnerPreferences {
  soughtStyles: SoughtStyle[];
  availability: string[];
  note: string | null;
  discoverable: boolean;
}

export interface FindPlayersFilters {
  city?: string | null;
  skill?: SkillLevel | null;
  style?: SoughtStyle | null;
}

interface FindPlayerRpcRow {
  user_id: string; full_name: string | null; avatar_url: string | null; city: string | null;
  username: string | null; skill_level: SkillLevel | null; play_goals: PlayGoal[] | null;
  grip: Grip | null; playing_style: PlayingStyle | null; dominant_hand: DominantHand | null;
  played_this_week: boolean; availability: string[] | null; pref_note: string | null;
}

export async function findPlayers(
  filters: FindPlayersFilters = {},
): Promise<{ data: FindPlayer[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('find_players', {
    p_city: filters.city ?? null,
    p_skill: filters.skill ?? null,
    p_style: filters.style ?? null,
  });
  if (error || !data) return { data: [], error };
  const items = (data as FindPlayerRpcRow[]).map((r) => ({
    userId: r.user_id, fullName: r.full_name ?? '', avatarUrl: r.avatar_url ?? null,
    city: r.city ?? null, username: r.username ?? null, skillLevel: r.skill_level ?? null,
    playGoals: r.play_goals ?? [], grip: r.grip ?? null, playingStyle: r.playing_style ?? null,
    dominantHand: r.dominant_hand ?? null, playedThisWeek: r.played_this_week,
    availability: r.availability ?? [], prefNote: r.pref_note ?? null,
  }));
  return { data: items, error: null };
}

export function sendMatchInvite(inviteeId: string, venueId?: number | null, note?: string | null) {
  return callRpc('send_match_invite', {
    p_invitee_id: inviteeId,
    p_venue_id: venueId ?? null,
    p_note: note ?? null,
  });
}

export function acceptMatchInvite(inviteId: number) {
  return callRpc('accept_match_invite', { p_invite_id: inviteId });
}

export function declineMatchInvite(inviteId: number) {
  return callRpc('decline_match_invite', { p_invite_id: inviteId });
}

interface PendingInviteRpcRow {
  id: number; inviter_id: string; inviter_name: string | null;
  venue_id: number | null; venue_name: string | null; note: string | null; created_at: string;
}

export async function getPendingMatchInvites(): Promise<{ data: PendingMatchInvite[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_pending_match_invites', {});
  if (error || !data) return { data: [], error };
  const items = (data as PendingInviteRpcRow[]).map((r) => ({
    id: r.id, inviterId: r.inviter_id, inviterName: r.inviter_name,
    venueId: r.venue_id, venueName: r.venue_name, note: r.note, createdAt: r.created_at,
  }));
  return { data: items, error: null };
}

export async function getPartnerPreferences(): Promise<{ data: PartnerPreferences | null; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_partner_preferences', {});
  if (error || !data) return { data: null, error };
  const rows = data as { sought_styles: SoughtStyle[] | null; availability: string[] | null; note: string | null; discoverable: boolean }[];
  if (!rows.length) return { data: null, error: null };
  const r = rows[0];
  return {
    data: {
      soughtStyles: r.sought_styles ?? [],
      availability: r.availability ?? [],
      note: r.note ?? null,
      discoverable: r.discoverable,
    },
    error: null,
  };
}

export function setPartnerPreferences(input: { soughtStyles?: SoughtStyle[]; availability?: string[]; note?: string | null }) {
  return callRpc('set_partner_preferences', {
    p_sought_styles: input.soughtStyles ?? [],
    p_availability: input.availability ?? [],
    p_note: input.note ?? null,
  });
}

export function setDiscoverable(value: boolean) {
  return callRpc('set_discoverable', { p_value: value });
}
