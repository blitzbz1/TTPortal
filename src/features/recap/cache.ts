// F052: persistent cache for the weekly recap (mirrors explorer/leaderboard).
import { cachedLoad, cachedSave, type CacheRead } from '../../lib/cacheUtils';
import type { WeeklyRecap } from '../../services/recap';

const TTL_MS = 10 * 60 * 1000; // 10min — a recap changes slowly within a week.

const key = (userId: string | undefined, weekStart: string | null | undefined) =>
  `weeklyRecap:${userId ?? 'me'}:${weekStart ?? 'current'}`;

export function loadCachedWeeklyRecap(
  userId: string | undefined,
  weekStart: string | null | undefined,
): CacheRead<WeeklyRecap> | null {
  return cachedLoad<WeeklyRecap>(key(userId, weekStart), TTL_MS);
}

export function saveCachedWeeklyRecap(
  userId: string | undefined,
  weekStart: string | null | undefined,
  data: WeeklyRecap,
): void {
  cachedSave(key(userId, weekStart), data);
}
