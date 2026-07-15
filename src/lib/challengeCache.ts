// Caches the badge-progress bundle (4 endpoints) the ChallengeScreen reads on
// mount. Invalidate on completion / award mutations.

import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 30 * 60 * 1000; // 30min

export type BadgeProgressBundle = {
  progress: any[];
  pending: any[];
  approved: any[];
  awards: any[];
};

const key = (userId: string) => `challenge:${userId}:bundle`;

export function loadCachedBadgeBundle(userId: string): CacheRead<BadgeProgressBundle> | null {
  return cachedLoad<BadgeProgressBundle>(key(userId), TTL_MS);
}
export function saveCachedBadgeBundle(userId: string, bundle: BadgeProgressBundle): void {
  cachedSave(key(userId), bundle);
}
export function invalidateChallengeCache(userId: string): void {
  cachedInvalidate(key(userId));
}
