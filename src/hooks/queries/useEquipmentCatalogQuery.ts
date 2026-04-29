import { useQuery } from '@tanstack/react-query';
import {
  applyCatalogDelta,
  readCatalog,
  type EquipmentCategory,
} from '../../lib/equipmentCatalogPersistentCache';
import { getEquipmentCatalogDelta } from '../../services/equipmentDelta';
import type { EquipmentManufacturer } from '../../types/database';

export const equipmentCatalogQueryKey = (category: EquipmentCategory) =>
  ['equipment-catalog', category] as const;

/**
 * Persistent, delta-synced equipment catalog.
 *
 * Equipment manufacturers + models are reference data that change rarely.
 * Cold sync ships the full catalogue; warm visits ship zero rows.
 *
 * Returns the same shape getEquipmentCatalog() did — array of
 * EquipmentManufacturer with embedded `models` strings — so the screen
 * code does not need to change.
 */
export function useEquipmentCatalogQuery(category: EquipmentCategory) {
  const buildShape = (manufacturers: any[], models: any[]): EquipmentManufacturer[] => {
    const modelsByManuf = new Map<string, string[]>();
    for (const m of models) {
      const list = modelsByManuf.get(m.manufacturer_id) ?? [];
      list.push(m.model);
      modelsByManuf.set(m.manufacturer_id, list);
    }
    return manufacturers.map((m) => ({
      id: m.manufacturer_id,
      name: m.name,
      models: modelsByManuf.get(m.manufacturer_id) ?? [],
    }));
  };

  return useQuery<EquipmentManufacturer[]>({
    queryKey: equipmentCatalogQueryKey(category),
    queryFn: async () => {
      const cached = readCatalog(category);
      const since = cached?.syncedAt ?? null;
      const { data, error } = await getEquipmentCatalogDelta(category, since);
      if (error || !data) {
        if (cached) return buildShape(cached.manufacturers, cached.models);
        throw error ?? new Error('equipment catalog delta failed and no cache');
      }
      const next = applyCatalogDelta(
        category,
        data.manufacturer_upserts ?? [],
        data.model_upserts ?? [],
        data.manufacturer_tombstones ?? [],
        data.model_tombstones ?? [],
        data.synced_at,
      );
      return buildShape(next.manufacturers, next.models);
    },
    initialData: () => {
      const cached = readCatalog(category);
      if (!cached) return undefined;
      return buildShape(cached.manufacturers, cached.models);
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
