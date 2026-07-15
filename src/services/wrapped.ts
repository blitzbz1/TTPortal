// F054: TT Wrapped (year-in-review) service. Thin wrapper over the SECURITY
// DEFINER RPC in migration 130 (not in the generated types yet → bound callRpc
// shim; the `.bind(supabase)` is load-bearing, see leaderboard.ts / ratings.ts /
// recap.ts / rpcBinding.test.ts). The RPC returns a single nested JSONB object.
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

/** The rule-based archetype keys returned by year_in_review (client localizes). */
export type WrappedArchetype =
  | 'grinder'
  | 'explorer'
  | 'social_player'
  | 'park_regular'
  | 'casual';

export interface WrappedTopVenue {
  id: number;
  name: string;
  checkins: number;
}

export interface WrappedTopMonth {
  /** Calendar month 1-12. */
  month: number;
  sessions: number;
}

export interface WrappedPartner {
  user_id: string;
  full_name: string | null;
}

/** One year's "TT Wrapped", aggregated over checkins + events + matches + badges. */
export interface YearInReview {
  year: number;
  hours: number;
  sessions: number;
  venues: number;
  events: number;
  badges: number;
  milestones: number;
  /** Distinct co-players across the year (tagged + match opponents). */
  partners: number;
  top_venue: WrappedTopVenue | null;
  top_month: WrappedTopMonth | null;
  partner_of_year: WrappedPartner | null;
  archetype: WrappedArchetype;
}

const ARCHETYPES: ReadonlySet<string> = new Set<WrappedArchetype>([
  'grinder',
  'explorer',
  'social_player',
  'park_regular',
  'casual',
]);

function coerceArchetype(value: unknown): WrappedArchetype {
  return typeof value === 'string' && ARCHETYPES.has(value)
    ? (value as WrappedArchetype)
    : 'casual';
}

/**
 * The caller's year-in-review. `year` is a 4-digit calendar year; omit it to
 * default to the current year (the RPC defaults to extract(year from now())).
 */
export async function getYearInReview(
  userId: string,
  year?: number | null,
): Promise<{ data: YearInReview | null; error: PostgrestError | null }> {
  const params: Record<string, unknown> = { p_user_id: userId };
  if (year != null) params.p_year = year;
  const { data, error } = await callRpc('year_in_review', params);
  if (error) return { data: null, error };
  // The RPC returns a single jsonb object (not a TABLE), so `data` is the object.
  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | null
    | undefined;
  if (!row) return { data: null, error: null };

  const topVenue = row.top_venue as Record<string, unknown> | null | undefined;
  const topMonth = row.top_month as Record<string, unknown> | null | undefined;
  const partner = row.partner_of_year as Record<string, unknown> | null | undefined;

  return {
    data: {
      year: Number(row.year ?? year ?? new Date().getUTCFullYear()),
      hours: Number(row.hours ?? 0),
      sessions: Number(row.sessions ?? 0),
      venues: Number(row.venues ?? 0),
      events: Number(row.events ?? 0),
      badges: Number(row.badges ?? 0),
      milestones: Number(row.milestones ?? 0),
      partners: Number(row.partners ?? 0),
      top_venue: topVenue
        ? {
            id: Number(topVenue.id),
            name: String(topVenue.name ?? ''),
            checkins: Number(topVenue.checkins ?? 0),
          }
        : null,
      top_month: topMonth
        ? {
            month: Number(topMonth.month),
            sessions: Number(topMonth.sessions ?? 0),
          }
        : null,
      partner_of_year: partner
        ? {
            user_id: String(partner.user_id),
            full_name:
              partner.full_name == null ? null : String(partner.full_name),
          }
        : null,
      archetype: coerceArchetype(row.archetype),
    },
    error: null,
  };
}
