import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { prepareImageForUpload, ImageProcessingUnavailableError } from '../lib/imageUpload';

export type EvidenceImageAsset = {
  uri: string;
  width?: number | null;
  height?: number | null;
};

export type EvidenceImageResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'rate_limited'; error: unknown }
  | { ok: false; reason: 'processing_unavailable' }
  | { ok: false; reason: 'upload_failed'; error: unknown };

/**
 * Resize an evidence image on-device and upload it to the `venue-photos`
 * bucket under `<pathPrefix>/<venueId>/`. Enforces the per-user daily image
 * cap BEFORE uploading (via the record_image_upload RPC), so an over-limit
 * attempt never reaches Storage. Returns the public URL.
 *
 * Shared by venue change requests (`change-requests/`) and condition votes
 * (`condition-votes/`).
 */
export async function uploadVenueEvidenceImage(
  pathPrefix: 'change-requests' | 'condition-votes',
  venueId: number,
  asset: EvidenceImageAsset,
): Promise<EvidenceImageResult> {
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
    const path = `${pathPrefix}/${venueId}/${Date.now()}.jpg`;
    let uploadData: Blob | ArrayBuffer | FormData;
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
