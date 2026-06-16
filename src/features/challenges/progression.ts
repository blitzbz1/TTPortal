import {
  BADGE_TIERS,
  BADGE_TRACKS,
  TIER_TARGETS,
  getBadgeLevel,
  getCurrentAwardTier,
  type BadgeTier,
  type BadgeTrack,
} from './badgeDefinitions';
import type { BadgeAward, ChallengeCategory, UserBadgeProgress } from './types';

export interface TrackProgressSummary {
  badge: BadgeTrack;
  category: ChallengeCategory;
  completedCount: number;
  currentTier: BadgeTier;
  currentTarget: number;
  currentProgress: number;
  remainingToTier: number;
  progressRatio: number;
  level: ReturnType<typeof getBadgeLevel>;
  latestAward?: BadgeAward;
  earnedTiers: BadgeTier[];
}

export function getTrackProgressSummaries(
  progressRows: UserBadgeProgress[],
  badgeAwards: BadgeAward[],
) {
  return BADGE_TRACKS.map((badge) => {
    const category = badge.category as ChallengeCategory;
    const progress = progressRows.find((row) => row.category === category);
    const completedCount = progress?.completed_count ?? 0;
    const currentTier = getCurrentAwardTier(completedCount);
    const currentTarget = TIER_TARGETS[currentTier];
    const currentProgress = Math.min(completedCount, currentTarget);
    const awardsForTrack = badgeAwards
      .filter((award) => award.category === category)
      .sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());
    const earnedTiers = BADGE_TIERS.filter((tier) => (
      awardsForTrack.some((award) => award.tier === tier)
    ));

    return {
      badge,
      category,
      completedCount,
      currentTier,
      currentTarget,
      currentProgress,
      remainingToTier: Math.max(0, currentTarget - currentProgress),
      progressRatio: currentTarget > 0 ? currentProgress / currentTarget : 0,
      level: getBadgeLevel(completedCount),
      latestAward: awardsForTrack[0],
      earnedTiers,
    } satisfies TrackProgressSummary;
  });
}

/** A challenge track has at least one challenge; badge-only tracks (F041
 *  Recruiter) have empty challenge lists and must not drive the challenge
 *  hero / featured / mastery aggregations (they have no challenge progress). */
function isChallengeTrack(summary: TrackProgressSummary): boolean {
  const t = summary.badge.challenges;
  return t.bronze.length + t.silver.length + t.gold.length > 0;
}

export function getFeaturedTrackSummary(summaries: TrackProgressSummary[]) {
  const challengeSummaries = summaries.filter(isChallengeTrack);
  const inProgress = challengeSummaries
    .filter((summary) => summary.completedCount > 0 && summary.level !== 'Gold')
    .sort((a, b) => b.completedCount - a.completedCount);
  if (inProgress[0]) return inProgress[0];

  const latestAwarded = challengeSummaries
    .filter((summary) => summary.latestAward)
    .sort((a, b) => (
      new Date(b.latestAward?.awarded_at ?? 0).getTime()
      - new Date(a.latestAward?.awarded_at ?? 0).getTime()
    ));
  if (latestAwarded[0]) return latestAwarded[0];

  return challengeSummaries.find((summary) => summary.badge.id === 'explorer') ?? challengeSummaries[0];
}

export function getMonthlyMasterySummary(summaries: TrackProgressSummary[]) {
  // Badge-only tracks (F041 Recruiter) have no challenge progress; exclude them
  // from the challenge-mastery aggregates so they don't skew the numbers.
  const challengeSummaries = summaries.filter(isChallengeTrack);
  const completed = challengeSummaries.reduce((sum, summary) => sum + summary.completedCount, 0);
  const earnedThisMonth = challengeSummaries.reduce((sum, summary) => (
    sum + summary.earnedTiers.length
  ), 0);
  const strongest = getFeaturedTrackSummary(challengeSummaries);

  return {
    completed,
    earnedThisMonth,
    strongest,
    tracksWithProgress: challengeSummaries.filter((summary) => summary.completedCount > 0).length,
  };
}
