import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getEquipmentHistory, saveEquipmentSelection } from '../../services/equipment';
import { loadCachedEquipmentHistory, saveCachedEquipmentHistory } from '../../lib/equipmentCache';
import type { EquipmentSelection, EquipmentSelectionInsert } from '../../types/database';

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
