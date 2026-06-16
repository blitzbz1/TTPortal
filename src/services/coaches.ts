// F063: coach directory reads/writes. Thin wrappers over the SECURITY DEFINER
// RPCs in migration 134 (apply_to_coach / get_venue_coaches /
// get_coaching_venue_ids) plus a public-read-when-approved table read of
// coach_profiles. The RPCs aren't in the generated supabase types yet, so the
// rpc name is cast via the bound callRpc shim (same pattern as services/equipment).
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { invalidateCoachProfileCache } from '../lib/coachesCache';
import type {
  CoachApplicationInput,
  CoachProfile,
  VenueCoach,
} from '../types/database';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

// coach_profiles / coach_venues land in migration 134 — not in the generated
// Database types yet, so `.from('coach_profiles')` won't typecheck. Use an
// untyped view of the client for those tables (same shim as equipmentReviews).
type UntypedFrom = { from: (table: string) => any };
const db = supabase as unknown as UntypedFrom;

const COACH_PROFILE_COLS =
  'id, user_id, status, bio, experience, levels, languages, price_range, contact, created_at';

/** Submit (or re-submit) a coach application. Resets to pending; replaces the
 *  venue set (≤3, enforced server-side). Returns the coach_profile id. */
export async function applyToCoach(userId: string, input: CoachApplicationInput) {
  const result = await (callRpc('apply_to_coach', {
    p_bio: input.bio,
    p_experience: input.experience,
    p_levels: input.levels,
    p_languages: input.languages,
    p_price_range: input.priceRange,
    p_contact: input.contact,
    p_venue_ids: input.venueIds,
  }) as RpcResponse<number>);
  if (!result.error) invalidateCoachProfileCache(userId);
  return result;
}

/** A user's coach_profile. Public-read-when-approved RLS: returns the approved
 *  row for anyone, the pending/rejected row only to its owner. Null when none
 *  is visible to the caller. */
export async function getCoachProfile(userId: string) {
  const { data, error } = await db
    .from('coach_profiles')
    .select(COACH_PROFILE_COLS)
    .eq('user_id', userId)
    .maybeSingle();
  return { data: (data as CoachProfile | null) ?? null, error };
}

/** The venues a coach has listed, for prefilling the re-apply form (the owner
 *  can read their own coach_venues regardless of approval status). Without this,
 *  re-applying sends an empty venue set and apply_to_coach wipes the coach's
 *  venues (it replaces the set). */
export async function getCoachVenues(coachId: number) {
  const { data, error } = await db
    .from('coach_venues')
    .select('venue_id, venues(name)')
    .eq('coach_id', coachId);
  const venues = ((data as { venue_id: number; venues: { name: string } | null }[] | null) ?? [])
    .map((r) => ({ id: r.venue_id, name: r.venues?.name ?? '' }));
  return { data: venues, error };
}

/** Approved coaches teaching at a venue (lazy "Coaches here" row). */
export async function getVenueCoaches(venueId: number) {
  const { data, error } = await callRpc('get_venue_coaches', { p_venue_id: venueId });
  return { data: ((data as VenueCoach[] | null) ?? []), error };
}

/** Venue ids in a city with ≥1 approved coach (map "Coaching" filter). */
export async function getCoachingVenueIds(city: string | null) {
  const { data, error } = await callRpc('get_coaching_venue_ids', { p_city: city ?? null });
  const ids = ((data as { venue_id: number }[] | null) ?? [])
    .map((r) => r.venue_id)
    .filter((v): v is number => typeof v === 'number');
  return { data: ids, error };
}
