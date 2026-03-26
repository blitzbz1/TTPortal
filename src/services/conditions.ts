import { supabase } from '../lib/supabase';
import type { ConditionVoteInsert } from '../types/database';

export async function submitVote(data: ConditionVoteInsert) {
  return supabase.from('condition_votes').insert(data).select().single();
}

export async function getVoteSummary(venueId: number) {
  return supabase
    .from('condition_votes')
    .select('condition')
    .eq('venue_id', venueId);
}
