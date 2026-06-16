import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getEquipmentHistory, getRubberWear, saveEquipmentSelection, setRubberInstall } from '../../services/equipment';
import {
  loadCachedEquipmentHistory,
  loadCachedRubberWear,
  saveCachedEquipmentHistory,
  saveCachedRubberWear,
} from '../../lib/equipmentCache';
import type { EquipmentSelection, EquipmentSelectionInsert, RubberSide, RubberWear } from '../../types/database';

const HISTORY_LIMIT = 4;

export const equipmentHistoryQueryKey = (userId: string | undefined) =>
  ['equipment-history', userId] as const;

/** Blessed shape (T050): queryFn mirrors to the domain cache; initialData
 *  hydrates from it so the screen paints offline. */
export function useEquipmentHistoryQuery(userId: string | undefined) {
  return useQuery<EquipmentSelection[]>({
    queryKey: equipmentHistoryQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getEquipmentHistory(userId, HISTORY_LIMIT);
      if (error) throw error;
      const history = (data ?? []) as EquipmentSelection[];
      saveCachedEquipmentHistory(userId, HISTORY_LIMIT, history);
      return history;
    },
    initialData: () =>
      userId ? loadCachedEquipmentHistory<EquipmentSelection>(userId, HISTORY_LIMIT)?.data : undefined,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

const rubberWearQueryKey = (userId: string | undefined) =>
  ['rubber-wear', userId] as const;

/** F061: per-side wear estimate. Same blessed shape — queryFn mirrors to the
 *  equipment domain cache; initialData hydrates from it so the card paints
 *  offline. */
export function useRubberWearQuery(userId: string | undefined) {
  return useQuery<RubberWear[]>({
    queryKey: rubberWearQueryKey(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await getRubberWear(userId);
      if (error) throw error;
      const wear = (data ?? []) as RubberWear[];
      saveCachedRubberWear(userId, wear);
      return wear;
    },
    initialData: () =>
      userId ? loadCachedRubberWear<RubberWear>(userId)?.data : undefined,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** F061: install / re-rubber a side, then refetch the wear estimate so the card
 *  reflects the reset clock immediately. */
export function useSetRubberInstallMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { side: RubberSide; installedAt: string; expectedHours: number }) => {
      if (!userId) throw new Error('not authenticated');
      const { error } = await setRubberInstall(userId, input.side, input.installedAt, input.expectedHours);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rubberWearQueryKey(userId) });
    },
  });
}

export function useSaveEquipmentMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EquipmentSelectionInsert) => {
      const { data, error } = await saveEquipmentSelection(input);
      if (error || !data) throw error ?? new Error('save failed');
      return data as EquipmentSelection;
    },
    onSuccess: (saved) => {
      // Optimistic prepend; the service already invalidated the domain cache.
      qc.setQueryData<EquipmentSelection[]>(equipmentHistoryQueryKey(userId), (prev) =>
        [saved, ...(prev ?? [])].slice(0, HISTORY_LIMIT),
      );
    },
  });
}
