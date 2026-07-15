// F054: persistent cache for the year-in-review (mirrors recap/explorer).
import { cachedLoad, cachedSave, type CacheRead } from '../../lib/cacheUtils';
import type { YearInReview } from '../../services/wrapped';

const TTL_MS = 60 * 60 * 1000; // 1h — a full year's recap changes very slowly.

const key = (userId: string | undefined, year: number | null | undefined) =>
  `yearInReview:${userId ?? 'me'}:${year ?? 'current'}`;

export function loadCachedYearInReview(
  userId: string | undefined,
  year: number | null | undefined,
): CacheRead<YearInReview> | null {
  return cachedLoad<YearInReview>(key(userId, year), TTL_MS);
}

export function saveCachedYearInReview(
  userId: string | undefined,
  year: number | null | undefined,
  data: YearInReview,
): void {
  cachedSave(key(userId, year), data);
}
