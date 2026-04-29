import {
  getCacheItem,
  setCacheItem,
  getCacheAge,
  removeCacheItem,
  removeCacheItemsByPrefix,
} from './offline-cache';

export type EventTabKey = 'upcoming' | 'past' | 'mine';

// "mine" and "past" change rarely — load instantly from cache and only refetch
// on explicit invalidation (event mutations) or pull-to-refresh. Long TTLs are
// a safety net in case an invalidation site is missed.
const TTL_MS: Record<EventTabKey, number> = {
  upcoming: 60 * 1000,
  mine: 6 * 60 * 60 * 1000,
  past: 12 * 60 * 60 * 1000,
};

const eventsKey = (userId: string, tab: EventTabKey) => `events:${userId}:${tab}`;
const feedbackGivenKey = (userId: string) => `events:${userId}:feedbackGiven`;

export function loadCachedEvents<T>(
  userId: string,
  tab: EventTabKey,
): { data: T[]; fresh: boolean } | null {
  const key = eventsKey(userId, tab);
  const data = getCacheItem<T[]>(key);
  if (!data) return null;
  const age = getCacheAge(key);
  return { data, fresh: age != null && age < TTL_MS[tab] };
}

export function saveCachedEvents<T>(userId: string, tab: EventTabKey, data: T[]): void {
  setCacheItem(eventsKey(userId, tab), data);
}

export function loadCachedFeedbackGiven(userId: string): number[] | null {
  return getCacheItem<number[]>(feedbackGivenKey(userId));
}

export function saveCachedFeedbackGiven(userId: string, ids: number[]): void {
  setCacheItem(feedbackGivenKey(userId), ids);
}

export function invalidateEventsCache(userId: string, tabs: EventTabKey[]): void {
  for (const tab of tabs) removeCacheItem(eventsKey(userId, tab));
}

export function invalidateFeedbackGivenCache(userId: string): void {
  removeCacheItem(feedbackGivenKey(userId));
}

// Wipe everything for the user (e.g. on sign-out).
export function clearAllEventsCacheForUser(userId: string): void {
  removeCacheItemsByPrefix(`events:${userId}:`);
}
