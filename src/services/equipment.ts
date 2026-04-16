import { supabase } from '../lib/supabase';
import type { EquipmentCategory, EquipmentManufacturer, EquipmentSelection, EquipmentSelectionInsert } from '../types/database';

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
  }) as unknown as Promise<{ data: EquipmentSelection[] | null; error: any }>;
}

export async function saveEquipmentSelection(data: EquipmentSelectionInsert) {
  return supabase
    .from('equipment_history')
    .insert(data)
    .select()
    .single();
}
