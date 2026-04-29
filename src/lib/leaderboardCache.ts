import { cachedLoad, cachedSave, type CacheRead } from './cacheUtils';

const TTL_MS: Record<'all' | 'week', number> = {
  all: 60 * 60 * 1000, // 1h
  week: 15 * 60 * 1000, // 15min
};

const key = (type: string, city: string | null | undefined, period: 'all' | 'week') =>
  `leaderboard:${type}:${city ?? 'global'}:${period}`;

export function loadCachedLeaderboard<T>(
  type: string,
  city: string | null | undefined,
  period: 'all' | 'week',
): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(type, city, period), TTL_MS[period]);
}
export function saveCachedLeaderboard<T>(
  type: string,
  city: string | null | undefined,
  period: 'all' | 'week',
  data: T[],
): void {
  cachedSave(key(type, city, period), data);
}
