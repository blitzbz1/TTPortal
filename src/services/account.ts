import { supabase } from '../lib/supabase';

/**
 * Soft-deletes the calling user's account by setting profiles.pending_deletion_at
 * to now() + 30 days on the server. The hard delete runs via a daily cron.
 *
 * Returns the timestamp at which the hard delete will run, or an error.
 */
export async function requestAccountDeletion() {
  const { data, error } = await supabase.rpc('request_account_deletion');
  return {
    data: data as string | null,
    error,
  };
}

/**
 * Cancels a pending account deletion. Safe to call when there is no pending
 * deletion (no-op).
 */
export async function cancelAccountDeletion() {
  const { error } = await supabase.rpc('cancel_account_deletion');
  return { error };
}
