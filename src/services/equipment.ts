import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { invalidateEquipmentCache, invalidateRubberWearCache } from '../lib/equipmentCache';
import type {
  EquipmentCategory,
  EquipmentManufacturer,
  EquipmentSelection,
  EquipmentSelectionInsert,
  RubberSide,
  RubberWear,
} from '../types/database';

// F061: get_rubber_wear / set_rubber_install ship in migration 132 — not in the
// generated types yet → callRpc shim, as elsewhere (checkinMoments/clubs).
type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

interface EquipmentManufacturerRow {
  manufacturer_id: string;
  name: string;
}

interface EquipmentModelRow {
  manufacturer_id: string;
  model: string;
}

export async function getEquipmentCatalog(category: EquipmentCategory) {
  const [manufacturersRes, modelsRes] = await Promise.all([
    supabase
      .from('equipment_catalog_manufacturers')
      .select('manufacturer_id, name')
      .eq('category', category)
      .order('sort_order', { ascending: true }),
    supabase
      .from('equipment_catalog_models')
      .select('manufacturer_id, model')
      .eq('category', category)
      .order('sort_order', { ascending: true }),
  ]);

  if (manufacturersRes.error || modelsRes.error) {
    return {
      data: null,
      error: manufacturersRes.error || modelsRes.error,
    };
  }

  const modelsByManufacturer = new Map<string, string[]>();
  for (const row of (modelsRes.data ?? []) as EquipmentModelRow[]) {
    const list = modelsByManufacturer.get(row.manufacturer_id) ?? [];
    list.push(row.model);
    modelsByManufacturer.set(row.manufacturer_id, list);
  }

  return {
    data: ((manufacturersRes.data ?? []) as EquipmentManufacturerRow[]).map((row): EquipmentManufacturer => ({
      id: row.manufacturer_id,
      name: row.name,
      models: modelsByManufacturer.get(row.manufacturer_id) ?? [],
    })),
    error: null,
  };
}

export async function getEquipmentHistory(userId: string, limit = 4) {
  return supabase
    .from('equipment_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function getCurrentEquipmentForUser(userId: string) {
  return supabase.rpc('current_equipment_for_user', {
    v_user_id: userId,
  }) as unknown as Promise<{ data: EquipmentSelection[] | null; error: PostgrestError | null }>;
}

export async function saveEquipmentSelection(data: EquipmentSelectionInsert) {
  const result = await supabase
    .from('equipment_history')
    .insert(data)
    .select()
    .single();
  if (!result.error && data.user_id) invalidateEquipmentCache(data.user_id);
  return result;
}

// ── Rubber wear tracker (F061) ──

/** Per-side wear estimate (check-in + event + training hours since install). */
export async function getRubberWear(userId: string): Promise<RpcResponse<RubberWear[]>> {
  const { data, error } = await callRpc('get_rubber_wear', { p_user_id: userId });
  if (error || !data) return { data: (data as RubberWear[] | null) ?? null, error };
  // expected_hours / estimated_hours are Postgres `numeric` → arrive as STRINGS
  // over PostgREST. Coerce so the wear card's stepper math (prev + delta) and
  // pct bars don't string-concatenate (mirrors profiles.ts numeric coercion).
  const rows = (data as RubberWear[]).map((r) => ({
    ...r,
    expected_hours: Number(r.expected_hours),
    estimated_hours: Number(r.estimated_hours),
  }));
  return { data: rows, error: null };
}

/** Install / re-rubber a side: sets installed_at + expected lifespan and resets
 *  the wear clock + the once-only reminder flag. Invalidates the wear cache (and
 *  the equipment cache, since the wear card reads the latest setup date). */
export async function setRubberInstall(
  userId: string,
  side: RubberSide,
  installedAt: string,
  expectedHours: number,
) {
  const result = await callRpc('set_rubber_install', {
    p_side: side,
    p_installed_at: installedAt,
    p_expected_hours: expectedHours,
  });
  if (!result.error) {
    invalidateRubberWearCache(userId);
    invalidateEquipmentCache(userId);
  }
  return result;
}
