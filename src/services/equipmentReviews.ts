import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  EquipmentCategory,
  EquipmentModelSummary,
  EquipmentReview,
  EquipmentReviewInput,
} from '../types/database';

// post_equipment_review / get_equipment_model_summary ship in migration 133 —
// not in the generated rpc types yet → callRpc shim, as elsewhere
// (equipment.ts F061, checkinMoments, clubs). Bind so the `this`-binding shim
// bug fixed in 2032f23 stays fixed.
type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

// equipment_reviews lands in migration 133 — not in the generated Database
// types yet, so `.from('equipment_reviews')` won't typecheck. Use an untyped
// view of the client for that table only (same shim philosophy as callRpc).
type UntypedFrom = {
  from: (table: string) => any;
};
const db = supabase as unknown as UntypedFrom;

/** Post (or edit) the caller's review of a catalog model. Owners only — the
 *  DEFINER RPC raises 'not_owned' otherwise. One review per user per model:
 *  re-posting EDITs in place. Returns the review id. */
export async function postEquipmentReview(input: EquipmentReviewInput) {
  return callRpc('post_equipment_review', {
    p_category: input.category,
    p_manufacturer_id: input.manufacturerId,
    p_model: input.model,
    p_rating: input.rating,
    p_speed: input.speed ?? null,
    p_spin: input.spin ?? null,
    p_control: input.control ?? null,
    p_time_used: input.timeUsed ?? null,
    p_body: input.body ?? null,
  }) as RpcResponse<number>;
}

/** Aggregate stats for a model: review_count, avg rating + axis bars, and the
 *  "N players use this" owner count. DEFINER RPC (counts across owner-only
 *  equipment_history). */
export async function getEquipmentModelSummary(
  category: EquipmentCategory,
  manufacturerId: string,
  model: string,
) {
  const { data, error } = await callRpc('get_equipment_model_summary', {
    p_category: category,
    p_manufacturer_id: manufacturerId,
    p_model: model,
  });
  // The RPC RETURNS TABLE → supabase yields an array of one row.
  const rows = (data as EquipmentModelSummary[] | null) ?? [];
  const raw = rows[0];
  if (!raw) return { data: null, error };
  // Postgres `numeric` (avg_*) deserializes to a STRING over PostgREST — coerce
  // so the screen's `.toFixed()` / bar math get real numbers (mirrors the
  // Number() coercion in profiles.ts / recap.ts for numeric RPC columns).
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    data: {
      ...raw,
      avg_rating: num(raw.avg_rating),
      avg_speed: num(raw.avg_speed),
      avg_spin: num(raw.avg_spin),
      avg_control: num(raw.avg_control),
    },
    error,
  };
}

/** Reviews for a model, newest first, with block-aware client-side filtering
 *  against the caller's user_blocks (mirror getReviewsForVenue — block
 *  visibility is service-layer, never RLS, per 072). */
export async function getEquipmentReviews(
  category: EquipmentCategory,
  manufacturerId: string,
  model: string,
) {
  const [reviewsResult, blocksResult] = await Promise.all([
    db
      .from('equipment_reviews')
      .select(
        'id, user_id, category, manufacturer_id, model, rating, speed, spin, control, time_used, body, author_hand, author_style, author_grip, flagged, flag_count, created_at',
      )
      .eq('category', category)
      .eq('manufacturer_id', manufacturerId)
      .eq('model', model)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('user_blocks').select('blocked_id'),
  ]);

  if (reviewsResult.error) {
    return { data: [] as EquipmentReview[], error: reviewsResult.error as PostgrestError };
  }

  const rows = (reviewsResult.data ?? []) as EquipmentReview[];
  const blocked = new Set(
    (blocksResult.data ?? []).map((row) => (row as { blocked_id: string }).blocked_id),
  );
  const data = blocked.size === 0 ? rows : rows.filter((r) => !blocked.has(r.user_id));
  return { data, error: null as PostgrestError | null };
}

/** Whether the caller owns a given model (a saved equipment_history setup
 *  references it). Drives the owner-only review form gate client-side; the
 *  server re-checks in post_equipment_review. RLS limits equipment_history to
 *  the caller's own rows, so this only ever sees the caller's setups. */
export async function callerOwnsModel(
  category: EquipmentCategory,
  manufacturerId: string,
  model: string,
) {
  if (category === 'blade') {
    const { data, error } = await supabase
      .from('equipment_history')
      .select('id')
      .eq('blade_manufacturer_id', manufacturerId)
      .eq('blade_model', model)
      .limit(1);
    return { data: (data ?? []).length > 0, error };
  }
  // Rubber: owned if mounted on the forehand OR backhand side of any setup.
  const [fh, bh] = await Promise.all([
    supabase
      .from('equipment_history')
      .select('id')
      .eq('forehand_rubber_manufacturer_id', manufacturerId)
      .eq('forehand_rubber_model', model)
      .limit(1),
    supabase
      .from('equipment_history')
      .select('id')
      .eq('backhand_rubber_manufacturer_id', manufacturerId)
      .eq('backhand_rubber_model', model)
      .limit(1),
  ]);
  const error = fh.error || bh.error;
  return { data: (fh.data ?? []).length > 0 || (bh.data ?? []).length > 0, error };
}
