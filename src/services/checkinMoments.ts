// F042: session moments service. Thin wrappers over the SECURITY DEFINER RPCs
// in migration 125 (not in the generated types yet → callRpc shim, as
// elsewhere) plus a dedicated image uploader for the new 'moments' bucket.
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { prepareImageForUpload, ImageProcessingUnavailableError } from '../lib/imageUpload';

type RpcResponse<T> = Promise<{ data: T | null; error: unknown }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export interface VenueMoment {
  id: number;
  user_id: string;
  venue_id: number;
  photo_url: string;
  caption: string | null;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  author_username: string | null;
}

export type MomentImageAsset = {
  uri: string;
  width?: number | null;
  height?: number | null;
};

export type MomentImageResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'rate_limited'; error: unknown }
  | { ok: false; reason: 'processing_unavailable' }
  | { ok: false; reason: 'upload_failed'; error: unknown };

/**
 * Resize a moment photo on-device and upload it to the dedicated `moments`
 * bucket under `moments/<userId>/<ts>.jpg`. Enforces the per-user daily image
 * cap BEFORE uploading (via the record_image_upload RPC). Mirrors
 * uploadVenueEvidenceImage but targets the moments bucket (migration 125).
 */
export async function uploadMomentImage(asset: MomentImageAsset): Promise<MomentImageResult> {
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

  // 2. Resolve the current user (the moments/<userId>/ path is required by the
  //    storage INSERT policy: prefix 'moments' + depth >= 2).
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, reason: 'upload_failed', error: new Error('not_authenticated') };

  // 3. Daily cap: count + record this attempt. Raises when over the limit.
  const { error: limitError } = await supabase.rpc('record_image_upload');
  if (limitError) {
    return { ok: false, reason: 'rate_limited', error: limitError };
  }

  // 4. Upload — same web-blob / native-FormData split as venue photos.
  try {
    const path = `moments/${userId}/${Date.now()}.jpg`;
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
      .from('moments')
      .upload(path, uploadData, {
        contentType,
        upsert: false,
        cacheControl: 'public, max-age=2592000, immutable',
      });
    if (uploadError) return { ok: false, reason: 'upload_failed', error: uploadError };
    const { data } = supabase.storage.from('moments').getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (err) {
    return { ok: false, reason: 'upload_failed', error: err };
  }
}

/** Recent venue moments visible to the caller: own + accepted friends, block-filtered server-side. */
export async function getVenueMoments(
  venueId: number,
  limit = 12,
): Promise<{ data: VenueMoment[]; error: unknown }> {
  const { data, error } = await callRpc('get_venue_moments', { p_venue_id: venueId, p_limit: limit });
  return { data: (data ?? []) as VenueMoment[], error };
}

/**
 * Attach (or replace) a photo + optional caption to a check-in the caller owns.
 * One moment per check-in — re-posting replaces. Returns the moment id.
 */
export async function postCheckinMoment(
  checkinId: number,
  venueId: number,
  photoUrl: string,
  caption?: string | null,
): Promise<{ data: number | null; error: unknown }> {
  const { data, error } = await callRpc('post_checkin_moment', {
    p_checkin_id: checkinId,
    p_venue_id: venueId,
    p_photo_url: photoUrl,
    p_caption: caption ?? undefined,
  });
  return { data: data as number | null, error };
}

/** Author soft-delete. */
export async function deleteCheckinMoment(momentId: number): Promise<{ data: unknown; error: unknown }> {
  const { data, error } = await callRpc('delete_checkin_moment', { p_id: momentId });
  return { data, error };
}
