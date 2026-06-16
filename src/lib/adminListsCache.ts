// Short-TTL cache for admin moderation lists. The admin screens are
// admin-only, so cache pressure is low (a handful of devices), but they
// are also viewed in long sessions where the same list is re-fetched on
// tab switches. A 5-minute TTL eliminates the per-tab refetch round-trip
// without making moderation feel stale — admins refresh manually when
// they act on a row, and write paths invalidate the cache directly.

import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 5 * 60 * 1000;

const KEYS = {
  pendingVenues: 'admin:pending-venues',
  flaggedReviews: 'admin:flagged-reviews',
  userFeedback: (limit: number) => `admin:user-feedback:${limit}`,
  venueChangeRequests: 'admin:venue-change-requests',
  pendingCoaches: 'admin:pending-coaches',
};

export function loadCachedPendingVenues<T>(): CacheRead<T[]> | null {
  return cachedLoad<T[]>(KEYS.pendingVenues, TTL_MS);
}
export function saveCachedPendingVenues<T>(data: T[]): void {
  cachedSave(KEYS.pendingVenues, data);
}
export function invalidatePendingVenuesCache(): void {
  cachedInvalidate(KEYS.pendingVenues);
}

export function loadCachedFlaggedReviews<T>(): CacheRead<T[]> | null {
  return cachedLoad<T[]>(KEYS.flaggedReviews, TTL_MS);
}
export function saveCachedFlaggedReviews<T>(data: T[]): void {
  cachedSave(KEYS.flaggedReviews, data);
}
export function invalidateFlaggedReviewsCache(): void {
  cachedInvalidate(KEYS.flaggedReviews);
}

export function loadCachedUserFeedback<T>(limit: number): CacheRead<T[]> | null {
  return cachedLoad<T[]>(KEYS.userFeedback(limit), TTL_MS);
}
export function saveCachedUserFeedback<T>(limit: number, data: T[]): void {
  cachedSave(KEYS.userFeedback(limit), data);
}
export function invalidateUserFeedbackCache(): void {
  // Limits vary by caller; nuke every variant.
  cachedInvalidate(KEYS.userFeedback(100));
  cachedInvalidate(KEYS.userFeedback(50));
  cachedInvalidate(KEYS.userFeedback(25));
}

export function loadCachedVenueChangeRequests<T>(): CacheRead<T[]> | null {
  return cachedLoad<T[]>(KEYS.venueChangeRequests, TTL_MS);
}
export function saveCachedVenueChangeRequests<T>(data: T[]): void {
  cachedSave(KEYS.venueChangeRequests, data);
}
export function invalidateVenueChangeRequestsCache(): void {
  cachedInvalidate(KEYS.venueChangeRequests);
}

export function loadCachedPendingCoaches<T>(): CacheRead<T[]> | null {
  return cachedLoad<T[]>(KEYS.pendingCoaches, TTL_MS);
}
export function saveCachedPendingCoaches<T>(data: T[]): void {
  cachedSave(KEYS.pendingCoaches, data);
}
export function invalidatePendingCoachesCache(): void {
  cachedInvalidate(KEYS.pendingCoaches);
}
