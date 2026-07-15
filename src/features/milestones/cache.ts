// F053: persistent cache for the caller's earned milestones (mirrors the
// explorer-progress cache).
import { cachedLoad, cachedSave, type CacheRead } from '../../lib/cacheUtils';
import type { UserMilestone } from '../../services/milestones';

const TTL_MS = 2 * 60 * 1000; // 2min — matches the query staleTime.

const key = (userId: string | null | undefined) => `userMilestones:${userId ?? 'anon'}`;

export function loadCachedMilestones(
  userId: string | null | undefined,
): CacheRead<UserMilestone[]> | null {
  return cachedLoad<UserMilestone[]>(key(userId), TTL_MS);
}

export function saveCachedMilestones(
  userId: string | null | undefined,
  data: UserMilestone[],
): void {
  cachedSave(key(userId), data);
}
