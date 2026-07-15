// F053: milestones service. Reads the caller's earned milestone rows from the
// RLS-scoped public.user_milestones table (migration 129). The table is not in
// the generated types yet, so `.from` is reached through a loosely-typed shim
// (mirrors the callRpc shim used for un-generated RPCs in explorer.ts /
// checkinMoments.ts); the row shape is asserted via `.returns<>()`.
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = supabase.from.bind(supabase) as unknown as (table: string) => any;

/** One earned milestone row (RLS-scoped to the caller). */
export interface UserMilestone {
  milestone_key: string;
  achieved_at: string;
}

/**
 * The caller's earned milestones, newest first. RLS limits the rows to the
 * authenticated user, so no user-id filter is needed (and a stranger can read
 * none). Returns a plain array; the hook caches it.
 */
export async function getUserMilestones(): Promise<{
  data: UserMilestone[];
  error: PostgrestError | null;
}> {
  const { data, error } = await fromTable('user_milestones')
    .select('milestone_key, achieved_at')
    .order('achieved_at', { ascending: false });
  return { data: (data as UserMilestone[] | null) ?? [], error };
}
