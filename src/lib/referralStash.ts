import { getStringSync, removeString, setString } from './mmkv';

// F041: a referral code opened pre-auth is stashed here so it can be claimed
// once a session resolves (the /join route round-trips through /sign-in). The
// returnTo param is the primary carrier; this MMKV stash is the belt-and-
// suspenders fallback for flows where the param is lost (cold-start deep link).
const REFERRAL_STASH_KEY = 'ttportal.pendingReferralCode';

export function stashPendingReferralCode(code: string): void {
  const normalized = code.trim().toUpperCase();
  if (normalized) setString(REFERRAL_STASH_KEY, normalized);
}

export function readPendingReferralCode(): string | null {
  return getStringSync(REFERRAL_STASH_KEY);
}

export function clearPendingReferralCode(): void {
  removeString(REFERRAL_STASH_KEY);
}
