import { supabase } from '../lib/supabase';

export type VenueChangeRequestInput = {
  /** Proposed nets value, or null/undefined for "no change". */
  nets?: boolean | null;
  /** Proposed night-lighting value, or null/undefined for "no change". */
  nightLighting?: boolean | null;
  /** Proposed table count, or null/undefined for "no change". */
  tablesCount?: number | null;
  /** Flag the venue as no longer available / not present. */
  markUnavailable?: boolean;
  /** Optional free-text note for the admin. */
  note?: string | null;
};

/**
 * Submit (or refresh) a venue change request proposing corrected attributes
 * and/or flagging the venue as no longer available. Re-submitting for the same
 * venue reopens the caller's existing request instead of creating a duplicate.
 * Returns the request id.
 */
export async function submitVenueChangeRequest(
  venueId: number,
  input: VenueChangeRequestInput,
) {
  const { data, error } = await supabase.rpc('submit_venue_change_request', {
    p_venue_id: venueId,
    p_nets: input.nets ?? null,
    p_night_lighting: input.nightLighting ?? null,
    p_tables_count: input.tablesCount ?? null,
    p_mark_unavailable: input.markUnavailable ?? false,
    p_note: input.note ?? null,
  });
  return { data: data as number | null, error };
}
