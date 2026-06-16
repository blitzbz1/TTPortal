import { supabase } from '../lib/supabase';
import type { TrainingSession, TrainingSessionInsert } from '../types/database';
import { invalidatePlayHistoryCache } from '../lib/playHistoryCache';
import { invalidateProfileStatsCache } from '../lib/profileCache';

/**
 * Log a training session (F060). Owner-only table (migration 131): the row's
 * user_id is set client-side and enforced by the INSERT RLS policy. On success
 * we invalidate the same two caches logEventHours does, since the new hours
 * feed PlayHistory's Training pill and the Profile combined-hours stat.
 */
export async function logTraining(input: TrainingSessionInsert) {
  const result = await supabase
    .from('training_sessions')
    .insert(input)
    .select()
    .single();
  if (!result.error) {
    invalidatePlayHistoryCache(input.user_id);
    invalidateProfileStatsCache(input.user_id);
  }
  return result;
}

/**
 * Read a user's own training sessions for a window (inclusive of sinceIso),
 * newest first. RLS limits this to auth.uid()'s rows; the play-history bundle
 * fetches the FULL window (not paginated) so the calendar/summary line up.
 */
export async function getTrainingSessions(userId: string, sinceIso?: string) {
  let query = supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', userId);
  if (sinceIso) query = query.gte('created_at', sinceIso);
  return query
    .order('created_at', { ascending: false })
    .returns<TrainingSession[]>();
}
