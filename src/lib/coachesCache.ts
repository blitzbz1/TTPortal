// F063: per-user coach_profile cache (the "I coach" status + the pinned card).
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 10 * 60 * 1000; // 10 min — invalidated on apply
const profileKey = (userId: string) => `coach:${userId}:profile`;

export function loadCachedCoachProfile<T>(userId: string): CacheRead<T> | null {
  return cachedLoad<T>(profileKey(userId), TTL_MS);
}
export function saveCachedCoachProfile<T>(userId: string, data: T): void {
  cachedSave(profileKey(userId), data);
}
export function invalidateCoachProfileCache(userId: string): void {
  cachedInvalidate(profileKey(userId));
}
