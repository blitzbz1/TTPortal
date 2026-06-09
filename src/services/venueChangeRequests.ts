import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { prepareImageForUpload, ImageProcessingUnavailableError } from '../lib/imageUpload';

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
    p_photo_url: input.photoUrl ?? null,
  });
  return { data: data as number | null, error };
}

export type ChangeRequestImageAsset = {
  uri: string;
  width?: number | null;
  height?: number | null;
};

export type ChangeRequestImageResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'rate_limited'; error: unknown }
  | { ok: false; reason: 'processing_unavailable' }
  | { ok: false; reason: 'upload_failed'; error: unknown };

/**
 * Resize an image on-device and upload it as evidence for a venue change
 * request. Enforces the per-user daily image cap BEFORE uploading (via the
 * record_image_upload RPC), so an over-limit attempt never reaches Storage.
 * The image lands in the `venue-photos` bucket under `change-requests/<venueId>/`,
 * mirroring the venue gallery upload pipeline.
 */
export async function uploadChangeRequestImage(
  venueId: number,
  asset: ChangeRequestImageAsset,
): Promise<ChangeRequestImageResult> {
  // 1. Resize on device first — local and free, so a failure here costs no quota.
  let uploadUri: string;
  try {
    uploadUri = await prepareImageForUpload({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
  } catch (err) {
    if (err instanceof ImageProcessingUnavailableError) {
      return { ok: false, reason: 'processing_unavailable' };
    }
    return { ok: false, reason: 'upload_failed', error: err };
  }

  // 2. Daily cap: count + record this attempt. Raises when over the limit,
  //    so we never reach the Storage upload below.
  const { error: limitError } = await supabase.rpc('record_image_upload');
  if (limitError) {
    return { ok: false, reason: 'rate_limited', error: limitError };
  }

  // 3. Upload to Storage — same web-blob / native-FormData split as venue photos.
  try {
    const path = `change-requests/${venueId}/${Date.now()}.jpg`;
    let uploadData: any;
    let contentType: string;
    if (Platform.OS === 'web') {
      const response = await fetch(uploadUri);
      uploadData = await response.blob();
      contentType = 'image/jpeg';
    } else {
      const formData = new FormData();
      formData.append('', {
        uri: uploadUri,
        name: `${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
      uploadData = formData;
      contentType = 'multipart/form-data';
    }
    const { error: uploadError } = await supabase.storage
      .from('venue-photos')
      .upload(path, uploadData, {
        contentType,
        upsert: false,
        cacheControl: 'public, max-age=2592000, immutable',
      });
    if (uploadError) return { ok: false, reason: 'upload_failed', error: uploadError };
    const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (err) {
    return { ok: false, reason: 'upload_failed', error: err };
  }
}
