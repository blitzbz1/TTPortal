import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const FRIENDS_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const PENDING_TTL_MS = 10 * 60 * 1000; // 10min — these come and go more often

const friendsKey = (userId: string) => `friends:${userId}:list`;
const pendingKey = (userId: string) => `friends:${userId}:pending`;

export function loadCachedFriends<T>(userId: string): CacheRead<T[]> | null {
  return cachedLoad<T[]>(friendsKey(userId), FRIENDS_TTL_MS);
}
export function saveCachedFriends<T>(userId: string, data: T[]): void {
  cachedSave(friendsKey(userId), data);
}
export function invalidateFriendsCache(userId: string): void {
  cachedInvalidate(friendsKey(userId));
}

export function loadCachedPending<T>(userId: string): CacheRead<T[]> | null {
  return cachedLoad<T[]>(pendingKey(userId), PENDING_TTL_MS);
}
export function saveCachedPending<T>(userId: string, data: T[]): void {
  cachedSave(pendingKey(userId), data);
}
export function invalidatePendingCache(userId: string): void {
  cachedInvalidate(pendingKey(userId));
}
