import { supabase } from '../lib/supabase';
import type { Json } from '../types/supabase';
import type { VenueAmenities } from '../lib/amenities';
import {
  uploadVenueEvidenceImage,
  type EvidenceImageAsset,
  type EvidenceImageResult,
} from './imageEvidence';

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
  /** Optional public URL of an attached evidence photo. */
  photoUrl?: string | null;
  /** F012: proposed amenity changes (partial map), or null for "no change". */
  amenities?: VenueAmenities | null;
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
    p_nets: input.nets ?? undefined,
    p_night_lighting: input.nightLighting ?? undefined,
    p_tables_count: input.tablesCount ?? undefined,
    p_mark_unavailable: input.markUnavailable ?? false,
    p_note: input.note ?? undefined,
    p_photo_url: input.photoUrl ?? undefined,
    // amenities is a plain JSON object at runtime; the typed struct just
    // lacks the index signature the generated Json type wants.
    p_amenities: (input.amenities ?? undefined) as Json | undefined,
  });
  return { data: data as number | null, error };
}

export type ChangeRequestImageAsset = EvidenceImageAsset;

export type ChangeRequestImageResult = EvidenceImageResult;

/**
 * Resize an image on-device and upload it as evidence for a venue change
 * request. The image lands in the `venue-photos` bucket under
 * `change-requests/<venueId>/`. See uploadVenueEvidenceImage for the
 * shared pipeline (daily cap, resize, web/native upload split).
 */
export async function uploadChangeRequestImage(
  venueId: number,
  asset: ChangeRequestImageAsset,
): Promise<ChangeRequestImageResult> {
  return uploadVenueEvidenceImage('change-requests', venueId, asset);
}
