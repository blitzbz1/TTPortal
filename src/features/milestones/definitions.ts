// F053: milestone catalog. The KEYS + thresholds here are the single client
// source of truth; the migration-129 server workers hold the SAME thresholds so
// the durable user_milestones rows match. Titles/labels come from i18n
// (milestone* keys); only non-localized presentation (metric, threshold, icon)
// lives here.

/** Which lifetime counter a milestone is measured against. */
export type MilestoneMetric = 'checkins' | 'venues' | 'hours' | 'reviews' | 'anniversary';

export interface MilestoneDef {
  /** Matches the milestone_key written by the migration-129 workers. */
  key: string;
  metric: MilestoneMetric;
  /**
   * The counter value at which the milestone unlocks. For 'reviews' it's 1
   * (first review) and for 'anniversary' it's the number of years (1).
   */
  threshold: number;
  /** i18n key for the milestone title (e.g. "100 check-ins"). */
  titleKey: string;
  /** Lucide icon name (registered in Icon.tsx). */
  icon: string;
}

/**
 * Every milestone, in display order. Grouped per metric and ascending by
 * threshold so the "next ghost" is the first unearned def of a metric.
 */
export const MILESTONE_DEFS: MilestoneDef[] = [
  // Check-ins — 10 / 50 / 100.
  { key: 'checkin_10', metric: 'checkins', threshold: 10, titleKey: 'milestoneCheckin10', icon: 'check-circle' },
  { key: 'checkin_50', metric: 'checkins', threshold: 50, titleKey: 'milestoneCheckin50', icon: 'check-circle' },
  { key: 'checkin_100', metric: 'checkins', threshold: 100, titleKey: 'milestoneCheckin100', icon: 'medal' },
  // Distinct venues — 10 / 25.
  { key: 'venues_10', metric: 'venues', threshold: 10, titleKey: 'milestoneVenues10', icon: 'map-pin' },
  { key: 'venues_25', metric: 'venues', threshold: 25, titleKey: 'milestoneVenues25', icon: 'compass' },
  // Hours played — 50 / 100 / 250.
  { key: 'hours_50', metric: 'hours', threshold: 50, titleKey: 'milestoneHours50', icon: 'clock' },
  { key: 'hours_100', metric: 'hours', threshold: 100, titleKey: 'milestoneHours100', icon: 'clock' },
  { key: 'hours_250', metric: 'hours', threshold: 250, titleKey: 'milestoneHours250', icon: 'trophy' },
  // One-off milestones.
  { key: 'first_review', metric: 'reviews', threshold: 1, titleKey: 'milestoneFirstReview', icon: 'star' },
  { key: 'anniversary_1y', metric: 'anniversary', threshold: 1, titleKey: 'milestoneAnniversary1y', icon: 'party-popper' },
];

/** Quick lookup of a definition by its key. */
export const MILESTONE_DEF_BY_KEY: Record<string, MilestoneDef> = Object.fromEntries(
  MILESTONE_DEFS.map((d) => [d.key, d]),
);

/** The lifetime counters used to compute milestone ghost progress. */
export interface MilestoneCounters {
  checkins: number;
  venues: number;
  hours: number;
  reviews: number;
  /** Whole years since the account was created (0 when unknown). */
  years: number;
}

/** The current value of the metric a milestone is measured against. */
export function milestoneCurrent(def: MilestoneDef, counters: MilestoneCounters): number {
  switch (def.metric) {
    case 'checkins':
      return counters.checkins;
    case 'venues':
      return counters.venues;
    case 'hours':
      return counters.hours;
    case 'reviews':
      return counters.reviews;
    case 'anniversary':
      return counters.years;
  }
}

/** Whole years between `since` and now (0 when `since` is null/unparseable). */
export function yearsSince(since: string | null | undefined): number {
  if (!since) return 0;
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return 0;
  const years = (Date.now() - start) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor(years));
}

/** A locked milestone the user is closest to, with its current progress. */
export interface MilestoneGhost {
  def: MilestoneDef;
  current: number;
  threshold: number;
}

/**
 * Metrics that read as a "X/Y progress" ghost (a running count toward a
 * threshold). The one-off milestones ('first_review', 'anniversary_1y') are
 * binary, not progressive, so they never surface as a count ghost.
 */
const GHOST_METRICS: ReadonlySet<MilestoneMetric> = new Set<MilestoneMetric>([
  'checkins',
  'venues',
  'hours',
]);

/**
 * The next locked milestone to surface as a "ghost" (e.g. "38/50 venues").
 * Considers only the progressive count metrics and picks the unearned def with
 * the smallest remaining gap to its threshold, so the strip nudges toward the
 * most-attainable goal. Requires some progress (current > 0) so a brand-new
 * user with zero activity gets a clean profile (no "0/10" nudge). Returns null
 * once every count milestone is earned, or none has measurable progress yet.
 */
export function nextMilestoneGhost(
  earnedKeys: Set<string>,
  counters: MilestoneCounters,
): MilestoneGhost | null {
  let best: MilestoneGhost | null = null;
  for (const def of MILESTONE_DEFS) {
    if (!GHOST_METRICS.has(def.metric)) continue;
    if (earnedKeys.has(def.key)) continue;
    const current = milestoneCurrent(def, counters);
    if (current <= 0) continue; // no progress yet — not worth a ghost.
    const remaining = def.threshold - current;
    if (remaining <= 0) continue; // crossed but not yet synced — skip as a ghost.
    if (best === null || remaining < best.threshold - best.current) {
      best = { def, current, threshold: def.threshold };
    }
  }
  return best;
}
