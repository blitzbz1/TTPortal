// F051: explorer-quest domain types. Quest definitions (predicate → map filter,
// icon, color) live on the client; tier targets + progress come from the RPC.
import type { BadgeTier } from '../challenges/badgeDefinitions';
import type { ExplorerQuestPredicate } from '../../services/explorer';

export type { ExplorerProgress, ExplorerQuestPredicate, ExplorerTier } from '../../services/explorer';

/** Static client metadata for a quest, keyed by the migration-127 quest key. */
export interface ExplorerQuestMeta {
  key: string;
  predicate: ExplorerQuestPredicate;
  /** Lucide icon name for the quest card (registered in Icon.tsx). */
  icon: string;
  /** Accent color (mirrors the badge-track palette feel). */
  color: string;
  paleColor: string;
  /**
   * The MapViewScreen FilterKey this quest's "Find one" jump pre-selects.
   * `undefined` for the 'all' quest (no chip pre-filter — the whole city).
   */
  mapFilter?: 'parcuri' | 'indoor' | 'verificat';
}

/**
 * Quest key to display metadata. Titles/labels come from i18n (explorer and
 * quest keys), so only non-localized presentation lives here.
 */
export const EXPLORER_QUEST_META: Record<string, ExplorerQuestMeta> = {
  venue_explorer: {
    key: 'venue_explorer',
    predicate: 'all',
    icon: 'compass',
    color: '#0f766e',
    paleColor: '#ccfbf1',
    mapFilter: undefined,
  },
  park_hopper: {
    key: 'park_hopper',
    predicate: 'park',
    icon: 'map-pin',
    color: '#16a34a',
    paleColor: '#dcfce7',
    mapFilter: 'parcuri',
  },
  indoor_initiate: {
    key: 'indoor_initiate',
    predicate: 'indoor',
    icon: 'building-2',
    color: '#2563eb',
    paleColor: '#dbeafe',
    mapFilter: 'indoor',
  },
};

export const EXPLORER_TIERS: BadgeTier[] = ['bronze', 'silver', 'gold'];

/** Target count for a quest+tier from an ExplorerProgress row. */
export function explorerTierTarget(
  quest: { bronze: number; silver: number; gold: number },
  tier: BadgeTier,
): number {
  return tier === 'gold' ? quest.gold : tier === 'silver' ? quest.silver : quest.bronze;
}

/** Whether a quest+tier is already earned, read from an ExplorerProgress row. */
export function explorerTierEarned(
  row: { earned_bronze: boolean; earned_silver: boolean; earned_gold: boolean },
  tier: BadgeTier,
): boolean {
  return tier === 'gold' ? row.earned_gold : tier === 'silver' ? row.earned_silver : row.earned_bronze;
}

/**
 * The tier the user is currently working toward (the lowest unearned tier), or
 * 'gold' once everything is earned — used to drive the active progress ring.
 */
export function explorerCurrentTier(row: {
  earned_bronze: boolean;
  earned_silver: boolean;
  earned_gold: boolean;
}): BadgeTier {
  if (!row.earned_bronze) return 'bronze';
  if (!row.earned_silver) return 'silver';
  return 'gold';
}
