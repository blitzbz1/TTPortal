import { createMMKV } from 'react-native-mmkv';

const store = createMMKV({ id: 'equipment-catalog-cache-v1' });

export type EquipmentCategory = 'blade' | 'rubber';

export interface PersistedManufacturer {
  category: EquipmentCategory;
  manufacturer_id: string;
  name: string;
  sort_order: number;
  updated_at: string;
}

export interface PersistedModel {
  category: EquipmentCategory;
  manufacturer_id: string;
  model: string;
  sort_order: number;
  updated_at: string;
}

export interface ManufacturerTombstone {
  category: EquipmentCategory;
  manufacturer_id: string;
}

export interface ModelTombstone {
  category: EquipmentCategory;
  manufacturer_id: string;
  model: string;
}

export interface EquipmentCatalogCache {
  manufacturers: PersistedManufacturer[];
  models: PersistedModel[];
  syncedAt: string;
}

const key = (category: EquipmentCategory) => `catalog:${category}`;

export function readCatalog(category: EquipmentCategory): EquipmentCatalogCache | null {
  const raw = store.getString(key(category));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EquipmentCatalogCache;
    if (!parsed || !Array.isArray(parsed.manufacturers) || !Array.isArray(parsed.models)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCatalog(category: EquipmentCategory, cache: EquipmentCatalogCache): void {
  store.set(key(category), JSON.stringify(cache));
}

export function applyCatalogDelta(
  category: EquipmentCategory,
  manufacturerUpserts: PersistedManufacturer[],
  modelUpserts: PersistedModel[],
  manufacturerTombstones: ManufacturerTombstone[],
  modelTombstones: ModelTombstone[],
  syncedAt: string,
): EquipmentCatalogCache {
  const existing =
    readCatalog(category) ?? { manufacturers: [], models: [], syncedAt: '' };

  const manufKey = (m: { manufacturer_id: string }) => m.manufacturer_id;
  const manufTombstoneSet = new Set(manufacturerTombstones.map(manufKey));
  const manufUpsertById = new Map(manufacturerUpserts.map((m) => [m.manufacturer_id, m]));

  const mergedManufacturers: PersistedManufacturer[] = [];
  for (const m of existing.manufacturers) {
    if (manufTombstoneSet.has(m.manufacturer_id)) continue;
    if (manufUpsertById.has(m.manufacturer_id)) continue;
    mergedManufacturers.push(m);
  }
  for (const m of manufUpsertById.values()) {
    if (!manufTombstoneSet.has(m.manufacturer_id)) mergedManufacturers.push(m);
  }
  mergedManufacturers.sort((a, b) => a.sort_order - b.sort_order);

  const modelKey = (m: { manufacturer_id: string; model: string }) => `${m.manufacturer_id}::${m.model}`;
  const modelTombstoneSet = new Set(modelTombstones.map(modelKey));
  const modelUpsertById = new Map(modelUpserts.map((m) => [modelKey(m), m]));

  // Cascade: any manufacturer tombstone implicitly removes its models.
  const mergedModels: PersistedModel[] = [];
  for (const m of existing.models) {
    if (manufTombstoneSet.has(m.manufacturer_id)) continue;
    if (modelTombstoneSet.has(modelKey(m))) continue;
    if (modelUpsertById.has(modelKey(m))) continue;
    mergedModels.push(m);
  }
  for (const m of modelUpsertById.values()) {
    if (manufTombstoneSet.has(m.manufacturer_id)) continue;
    if (!modelTombstoneSet.has(modelKey(m))) mergedModels.push(m);
  }
  mergedModels.sort((a, b) => a.sort_order - b.sort_order);

  const next: EquipmentCatalogCache = {
    manufacturers: mergedManufacturers,
    models: mergedModels,
    syncedAt,
  };
  writeCatalog(category, next);
  return next;
}
