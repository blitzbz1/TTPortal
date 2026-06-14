// F016: venue board & Q&A service. Thin wrappers over the SECURITY DEFINER RPCs
// in migration 112 (not in the generated types yet → callRpc shim, as elsewhere).
import { supabase } from '../lib/supabase';

type RpcResponse<T> = Promise<{ data: T | null; error: unknown }>;
const callRpc = supabase.rpc as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export interface BoardReply {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

export interface BoardPost {
  id: number;
  user_id: string;
  body: string;
  helpful_count: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  viewer_voted: boolean;
  replies: BoardReply[];
}

/** Paged board read (newest first). Excludes flagged posts + blocked authors. */
export async function getVenueBoard(
  venueId: number,
  limit = 20,
): Promise<{ data: BoardPost[]; error: unknown }> {
  const { data, error } = await callRpc('get_venue_board', { p_venue_id: venueId, p_limit: limit });
  return { data: (data ?? []) as BoardPost[], error };
}

/** Post a question/note (parentId null) or a one-level reply. Returns the id. */
export async function postVenueMessage(venueId: number, body: string, parentId: number | null = null) {
  return callRpc('post_venue_message', {
    p_venue_id: venueId,
    p_body: body,
    p_parent_id: parentId ?? undefined,
  });
}

/** Toggle a helpful vote; returns the new count. */
export async function togglePostHelpful(postId: number) {
  return callRpc('toggle_post_helpful', { p_post_id: postId });
}

/** Author soft-delete. */
export async function deleteVenuePost(postId: number) {
  return callRpc('delete_venue_post', { p_post_id: postId });
}
