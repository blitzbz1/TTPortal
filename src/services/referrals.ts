// F041: referrals service. Thin wrappers over the SECURITY DEFINER RPCs in
// migration 124 (not in the generated types yet → bound callRpc shim; the
// `.bind(supabase)` is load-bearing, see clubs.ts / rpcBinding.test.ts). Every
// function returns Supabase-style { data, error }.
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

/** The caller's referral code + how many users they've referred. */
export interface ReferralStats {
  referral_code: string | null;
  invited_count: number;
}

/** Claim a referral by code → returns the referrer's user id (or error). */
export function claimReferral(code: string) {
  return callRpc('claim_referral', { p_code: code }) as RpcResponse<string>;
}

/** The caller's referral code + invited count. */
export async function getReferralStats(): Promise<{ data: ReferralStats | null; error: unknown }> {
  const { data, error } = await callRpc('get_referral_stats');
  const row = Array.isArray(data) ? data[0] : data;
  return { data: (row ?? null) as ReferralStats | null, error };
}

/**
 * Resolve a referral code to a public profile. Mirrors friends.findUserByUsername
 * normalization (trim, uppercase, min-length guard); codes are stored uppercase.
 */
export async function findProfileByReferralCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 6) return { data: null, error: null };

  return supabase
    .from('profiles')
    .select('id, full_name, avatar_url, username')
    .eq('referral_code', normalized)
    .maybeSingle();
}
