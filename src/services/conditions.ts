import { supabase } from '../lib/supabase';
import type { ConditionVoteInsert } from '../types/database';
import {
  uploadVenueEvidenceImage,
  type EvidenceImageAsset,
  type EvidenceImageResult,
} from './imageEvidence';

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

export async function getVoteSummary(venueId: number) {
  return supabase
    .from('condition_votes')
    .select('condition')
    .eq('venue_id', venueId);
}
