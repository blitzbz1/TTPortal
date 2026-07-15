import { supabase } from '../lib/supabase';
import type { ConditionVoteInsert, ConditionVoteValue } from '../types/database';
import {
  uploadVenueEvidenceImage,
  type EvidenceImageAsset,
  type EvidenceImageResult,
} from './imageEvidence';

/** UI-level table-condition choice surfaced in the suggest-an-edit modal. */
export type ConditionChoice = 'good' | 'acceptable' | 'damaged';

/** UI choice → stored vote value (migration 086). */
export const CONDITION_MAP: Record<ConditionChoice, ConditionVoteValue> = {
  good: 'buna',
  acceptable: 'acceptabila',
  damaged: 'deteriorata',
};

/**
 * Upload a condition-vote photo and return its public URL. Mirrors the
 * change-request evidence flow (resize → daily-cap RPC → Storage upload);
 * the image lands under `condition-votes/<venueId>/`.
 */
export async function uploadConditionVotePhoto(
  venueId: number,
  asset: EvidenceImageAsset,
): Promise<EvidenceImageResult> {
  return uploadVenueEvidenceImage('condition-votes', venueId, asset);
}

export async function submitVote(data: ConditionVoteInsert) {
  // One vote per user per venue (migration 086): re-voting updates the
  // user's existing vote in place.
  return supabase
    .from('condition_votes')
    .upsert(data, { onConflict: 'user_id,venue_id' })
    .select()
    .single();
}
