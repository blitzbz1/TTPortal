// Caches the parts of a venue detail screen that are slow-changing:
// the venue meta (incl. photos) and its reviews. Live data — active checkins,
// venue champion, upcoming-events count, friend presence — is always fetched
// fresh, since freshness is the user's whole reason for opening the screen.

import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const META_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const REVIEWS_TTL_MS = 4 * 60 * 60 * 1000; // 4h

const metaKey = (venueId: number) => `venue:${venueId}:meta`;
const reviewsKey = (venueId: number) => `venue:${venueId}:reviews`;

export function loadCachedVenueMeta<T>(venueId: number): CacheRead<T> | null {
  return cachedLoad<T>(metaKey(venueId), META_TTL_MS);
}
export function saveCachedVenueMeta<T>(venueId: number, data: T): void {
  cachedSave(metaKey(venueId), data);
}
export function invalidateVenueMetaCache(venueId: number): void {
  cachedInvalidate(metaKey(venueId));
}

export function loadCachedVenueReviews<T>(venueId: number): CacheRead<T[]> | null {
  return cachedLoad<T[]>(reviewsKey(venueId), REVIEWS_TTL_MS);
}
export function saveCachedVenueReviews<T>(venueId: number, data: T[]): void {
  cachedSave(reviewsKey(venueId), data);
}
export function invalidateVenueReviewsCache(venueId: number): void {
  cachedInvalidate(reviewsKey(venueId));
}
