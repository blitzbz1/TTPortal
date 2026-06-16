import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  callerOwnsModel,
  getEquipmentModelSummary,
  getEquipmentReviews,
  postEquipmentReview,
} from '../../services/equipmentReviews';
import type {
  EquipmentCategory,
  EquipmentModelSummary,
  EquipmentReview,
  EquipmentReviewInput,
} from '../../types/database';

type ModelKey = {
  category: EquipmentCategory;
  manufacturerId: string;
  model: string;
};

const equipmentModelSummaryKey = (m: ModelKey) =>
  ['equipment-model-summary', m.category, m.manufacturerId, m.model] as const;

const equipmentModelReviewsKey = (m: ModelKey) =>
  ['equipment-model-reviews', m.category, m.manufacturerId, m.model] as const;

const equipmentModelOwnedKey = (m: ModelKey, userId: string | undefined) =>
  ['equipment-model-owned', m.category, m.manufacturerId, m.model, userId] as const;

const enabledFor = (m: ModelKey) => Boolean(m.manufacturerId && m.model);

/** Aggregate stats (stars, speed/spin/control, "N players use this"). */
export function useEquipmentModelSummaryQuery(m: ModelKey) {
  return useQuery<EquipmentModelSummary | null>({
    queryKey: equipmentModelSummaryKey(m),
    queryFn: async () => {
      const { data, error } = await getEquipmentModelSummary(m.category, m.manufacturerId, m.model);
      if (error) throw error;
      return data;
    },
    enabled: enabledFor(m),
    staleTime: 5 * 60 * 1000,
  });
}

/** Reviews for the model, newest first, block-filtered in the service. */
export function useEquipmentModelReviewsQuery(m: ModelKey) {
  return useQuery<EquipmentReview[]>({
    queryKey: equipmentModelReviewsKey(m),
    queryFn: async () => {
      const { data, error } = await getEquipmentReviews(m.category, m.manufacturerId, m.model);
      if (error) throw error;
      return data;
    },
    enabled: enabledFor(m),
    staleTime: 5 * 60 * 1000,
  });
}

/** Whether the signed-in caller owns the model (gates the review form). */
export function useCallerOwnsModelQuery(m: ModelKey, userId: string | undefined) {
  return useQuery<boolean>({
    queryKey: equipmentModelOwnedKey(m, userId),
    queryFn: async () => {
      const { data, error } = await callerOwnsModel(m.category, m.manufacturerId, m.model);
      if (error) throw error;
      return data;
    },
    enabled: enabledFor(m) && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Post (or edit) the caller's review, then refetch summary + reviews so the
 *  model page reflects it immediately. */
export function usePostEquipmentReviewMutation(m: ModelKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EquipmentReviewInput) => {
      const { data, error } = await postEquipmentReview(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: equipmentModelSummaryKey(m) });
      qc.invalidateQueries({ queryKey: equipmentModelReviewsKey(m) });
    },
  });
}
