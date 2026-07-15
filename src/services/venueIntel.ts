// Live venue-intelligence service (Phase 2): busyness + live counts (F010),
// free-table reports (F011), regulars (F014). Thin wrappers over the
// SECURITY DEFINER RPCs in migrations 106+. These RPCs aren't in the generated
// supabase types yet, so the rpc name is cast (same shim as services/matches).
import { supabase } from '../lib/supabase';
import type { VenueAmenities } from '../lib/amenities';

type RpcResponse<T> = Promise<{ data: T | null; error: unknown }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

// ── F010: busyness ─────────────────────────────────────────────────────────

/** One hour of the typical-day histogram. */
export interface BusynessHour {
  hour: number;
  count: number;
}

export interface VenueBusyness {
  /** Active check-ins right now (anonymous count). */
  live_count: number;
  /** Total check-ins in the 12-week window — gates the empty state. */
  sample_size: number;
  /** Busiest hour of the typical week, or null below the sample threshold. */
  peak_hour?: number | null;
  /** Overall (all weekdays) hour curve; null below the sample threshold. */
  histogram?: BusynessHour[] | null;
  /** Per-weekday ("0"=Sun .. "6"=Sat) hour curves for the weekday selector. */
  by_weekday?: Record<string, BusynessHour[]>;
}

/**
 * Venue-detail busyness bundle (106). Lightweight and non-fatal — merged into
 * useVenueDetailQuery alongside the player mix; a failure must not block the
 * detail load.
 */
export async function getVenueBusyness(
  venueId: number,
): Promise<{ data: VenueBusyness | null; error: unknown }> {
  const { data, error } = await callRpc('get_venue_busyness', { p_venue_id: venueId });
  return { data: (data as VenueBusyness | null) ?? null, error };
}

export interface LiveVenueCount {
  venue_id: number;
  active_count: number;
}

/**
 * Per-venue live check-in counts for a city (106) — backs the anonymous
 * live-count dots on the map. Counts only, no identities.
 */
export async function getLiveVenueCounts(
  cityId: number | null,
): Promise<{ data: LiveVenueCount[]; error: unknown }> {
  const { data, error } = await callRpc('get_live_venue_counts', {
    p_city_id: cityId ?? null,
  });
  return { data: (data ?? []) as LiveVenueCount[], error };
}

// ── F011: free-table reports ────────────────────────────────────────────────

/** Latest fresh free-table report for a venue (anonymous; decays ~90 min). */
export interface VenueFreeTables {
  free_count: number;
  group_size: number | null;
  reported_at: string;
  age_minutes: number;
}

/** Report how many tables are free right now (107). Returns the new report id. */
export async function reportFreeTables(
  venueId: number,
  freeCount: number,
  groupSize: number | null = null,
) {
  return callRpc('report_free_tables', {
    p_venue_id: venueId,
    p_free_count: freeCount,
    p_group_size: groupSize ?? null,
  });
}

/** Latest fresh free-table report for venue detail (107). Null if stale/none. */
export async function getVenueFreeTables(
  venueId: number,
): Promise<{ data: VenueFreeTables | null; error: unknown }> {
  const { data, error } = await callRpc('get_venue_free_tables', { p_venue_id: venueId });
  return { data: (data as VenueFreeTables | null) ?? null, error };
}

// ── F012: amenities ─────────────────────────────────────────────────────────

export interface CityVenueAmenities {
  venue_id: number;
  amenities: VenueAmenities;
}

/** Structured amenities for a single venue (108), merged into the bundle. */
export async function getVenueAmenities(
  venueId: number,
): Promise<{ data: VenueAmenities | null; error: unknown }> {
  const { data, error } = await callRpc('get_venue_amenities', { p_venue_id: venueId });
  return { data: (data as VenueAmenities | null) ?? null, error };
}

/** Per-venue amenities for a city (108) — backs the map "free entry"/"rental" chips. */
export async function getCityVenueAmenities(
  cityId: number | null,
): Promise<{ data: CityVenueAmenities[]; error: unknown }> {
  const { data, error } = await callRpc('get_city_venue_amenities', {
    p_city_id: cityId ?? null,
  });
  return { data: (data ?? []) as CityVenueAmenities[], error };
}

// ── F014: home venue & regulars ─────────────────────────────────────────────

export interface RegularProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}
export interface VenueRegulars {
  count: number;
  regulars: RegularProfile[];
}
export interface HomeVenue {
  id: number;
  name: string;
}

/** Opt-in regulars (count + capped avatar list) for a venue (110). */
export async function getVenueRegulars(
  venueId: number,
): Promise<{ data: VenueRegulars | null; error: unknown }> {
  const { data, error } = await callRpc('get_venue_regulars', { p_venue_id: venueId });
  return { data: (data as VenueRegulars | null) ?? null, error };
}

/** A user's home venue (id + name) for "plays at X" (110). Null if unset. */
export async function getHomeVenue(
  userId: string,
): Promise<{ data: HomeVenue | null; error: unknown }> {
  const { data, error } = await callRpc('get_home_venue', { p_user_id: userId });
  return { data: (data as HomeVenue | null) ?? null, error };
}

/** Suggest a home venue from the caller's check-in history (110). Null if none. */
export async function suggestHomeVenue(): Promise<{ data: HomeVenue | null; error: unknown }> {
  const { data, error } = await callRpc('suggest_home_venue');
  return { data: (data as HomeVenue | null) ?? null, error };
}
