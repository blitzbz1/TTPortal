// F040: clubs & groups service. Thin wrappers over the SECURITY DEFINER RPCs
// in migration 123 (not in the generated types yet → bound callRpc shim; the
// `.bind(supabase)` is load-bearing, see __tests__/rpcBinding.test.ts). Every
// function returns Supabase-style { data, error } — hooks throw on error.
import { Platform } from 'react-native';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { prepareImageForUpload, ImageProcessingUnavailableError } from '../lib/imageUpload';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export type ClubRole = 'admin' | 'member';

/** A club row in the caller's club list. */
export interface MyClub {
  id: number;
  name: string;
  avatar_url: string | null;
  role: ClubRole;
  member_count: number;
  city_id: number | null;
  home_venue_id: number | null;
  home_venue_name: string | null;
}

/** A member inside a club detail payload. */
export interface ClubMember {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  role: ClubRole;
}

/** One upcoming club event inside a club detail payload. */
export interface ClubUpcomingEvent {
  id: number;
  title: string;
  starts_at: string;
  venue_id: number | null;
}

export interface ClubDetail {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  join_code: string;
  city_id: number | null;
  home_venue_id: number | null;
  home_venue_name: string | null;
  owner_id: string;
  my_role: ClubRole | null;
  member_count: number;
  members: ClubMember[];
  upcoming_events: ClubUpcomingEvent[];
}

/** Pre-join preview resolved from a join code. */
export interface ClubByCode {
  id: number;
  name: string;
  avatar_url: string | null;
  member_count: number;
  already_member: boolean;
}

export interface CreateClubInput {
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  cityId?: number | null;
  homeVenueId?: number | null;
}

export type ClubAvatarResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'rate_limited'; error: unknown }
  | { ok: false; reason: 'processing_unavailable' }
  | { ok: false; reason: 'upload_failed'; error: unknown };

// --- writes ---------------------------------------------------------------
export function createClub(input: CreateClubInput) {
  return callRpc('create_club', {
    p_name: input.name,
    p_description: input.description ?? null,
    p_avatar_url: input.avatarUrl ?? null,
    p_city_id: input.cityId ?? null,
    p_home_venue_id: input.homeVenueId ?? null,
  }) as RpcResponse<number>;
}

export function joinClubByCode(code: string) {
  return callRpc('join_club_by_code', { p_code: code }) as RpcResponse<number>;
}

export function leaveClub(clubId: number) {
  return callRpc('leave_club', { p_club_id: clubId });
}

export function removeClubMember(clubId: number, userId: string) {
  return callRpc('remove_club_member', { p_club_id: clubId, p_user_id: userId });
}

export function rotateClubJoinCode(clubId: number) {
  return callRpc('rotate_club_join_code', { p_club_id: clubId }) as RpcResponse<string>;
}

// --- reads ----------------------------------------------------------------
export async function getMyClubs(): Promise<{ data: MyClub[]; error: unknown }> {
  const { data, error } = await callRpc('get_my_clubs');
  return { data: (data ?? []) as MyClub[], error };
}

export async function getClubDetail(clubId: number): Promise<{ data: ClubDetail | null; error: unknown }> {
  const { data, error } = await callRpc('get_club_detail', { p_club_id: clubId });
  const row = Array.isArray(data) ? data[0] : data;
  return { data: (row ?? null) as ClubDetail | null, error };
}

export async function getClubByCode(code: string): Promise<{ data: ClubByCode | null; error: unknown }> {
  const { data, error } = await callRpc('get_club_by_code', { p_code: code });
  const row = Array.isArray(data) ? data[0] : data;
  return { data: (row ?? null) as ClubByCode | null, error };
}

// --- avatar upload (reuses the venue-photos bucket under a clubs/ prefix) ---
/**
 * Resize a club avatar on-device and upload it to the `venue-photos` bucket
 * under `clubs/<userId>/<ts>.jpg`. Mirrors uploadVenueEvidenceImage: prep →
 * daily-cap RPC → upload → public URL. The clubs/ prefix is allow-listed in
 * the storage INSERT policy (migration 123 extends 092).
 */
export async function uploadClubAvatar(
  userId: string,
  asset: { uri: string; width?: number | null; height?: number | null },
): Promise<ClubAvatarResult> {
  let uploadUri: string;
  try {
    uploadUri = await prepareImageForUpload(
      { uri: asset.uri, width: asset.width, height: asset.height },
      { maxDimension: 512 },
    );
  } catch (err) {
    if (err instanceof ImageProcessingUnavailableError) {
      return { ok: false, reason: 'processing_unavailable' };
    }
    return { ok: false, reason: 'upload_failed', error: err };
  }

  const { error: limitError } = await supabase.rpc('record_image_upload');
  if (limitError) {
    return { ok: false, reason: 'rate_limited', error: limitError };
  }

  try {
    const path = `clubs/${userId}/${Date.now()}.jpg`;
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
