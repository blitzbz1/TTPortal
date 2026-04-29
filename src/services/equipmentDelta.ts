import { supabase } from '../lib/supabase';
import type {
  EquipmentCategory,
  ManufacturerTombstone,
  ModelTombstone,
  PersistedManufacturer,
  PersistedModel,
} from '../lib/equipmentCatalogPersistentCache';

export interface EquipmentCatalogDeltaResponse {
  manufacturer_upserts: PersistedManufacturer[];
  model_upserts: PersistedModel[];
  manufacturer_tombstones: ManufacturerTombstone[];
  model_tombstones: ModelTombstone[];
  synced_at: string;
}

export async function getEquipmentCatalogDelta(
  category: EquipmentCategory,
  since: string | null,
): Promise<{ data: EquipmentCatalogDeltaResponse | null; error: any }> {
  const { data, error } = await supabase.rpc('get_equipment_catalog_delta', {
    p_category: category,
    p_since: since,
  });
  return { data: (data as EquipmentCatalogDeltaResponse | null) ?? null, error };
}
