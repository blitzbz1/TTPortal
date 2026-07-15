// F051: persistent cache for explorer-quest progress (mirrors leaderboardCache).
import { cachedLoad, cachedSave, type CacheRead } from '../../lib/cacheUtils';
import type { ExplorerProgress } from '../../services/explorer';

const TTL_MS = 2 * 60 * 1000; // 2min — matches the query staleTime.

// Keyed by userId AND city — like the other Phase-6 caches (userMilestones /
// weeklyRecap / yearInReview). A city-only key let the next user on a shared
// device hydrate the previous user's progress (brief cross-user exposure +
// celebration-baseline poisoning) since the SQLite store survives sign-out.
const key = (userId: string | undefined, city: string | null | undefined) =>
  `explorerProgress:${userId ?? 'anon'}:${city ?? 'global'}`;

export function loadCachedExplorerProgress(
  userId: string | undefined,
  city: string | null | undefined,
): CacheRead<ExplorerProgress[]> | null {
  return cachedLoad<ExplorerProgress[]>(key(userId, city), TTL_MS);
}

export function saveCachedExplorerProgress(
  userId: string | undefined,
  city: string | null | undefined,
  data: ExplorerProgress[],
): void {
  cachedSave(key(userId, city), data);
}
