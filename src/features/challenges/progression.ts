import {
  BADGE_TIERS,
  BADGE_TRACKS,
  TIER_TARGETS,
  getBadgeLevel,
  getCurrentAwardTier,
  type BadgeTier,
  type BadgeTrack,
} from '../../lib/badgeChallenges';
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

export function getFeaturedTrackSummary(summaries: TrackProgressSummary[]) {
  const inProgress = summaries
    .filter((summary) => summary.completedCount > 0 && summary.level !== 'Gold')
    .sort((a, b) => b.completedCount - a.completedCount);
  if (inProgress[0]) return inProgress[0];

  const latestAwarded = summaries
    .filter((summary) => summary.latestAward)
    .sort((a, b) => (
      new Date(b.latestAward?.awarded_at ?? 0).getTime()
      - new Date(a.latestAward?.awarded_at ?? 0).getTime()
    ));
  if (latestAwarded[0]) return latestAwarded[0];

  return summaries.find((summary) => summary.badge.id === 'explorer') ?? summaries[0];
}

export function getMonthlyMasterySummary(summaries: TrackProgressSummary[]) {
  const completed = summaries.reduce((sum, summary) => sum + summary.completedCount, 0);
  const earnedThisMonth = summaries.reduce((sum, summary) => (
    sum + summary.earnedTiers.length
  ), 0);
  const strongest = getFeaturedTrackSummary(summaries);

  return {
    completed,
    earnedThisMonth,
    strongest,
    tracksWithProgress: summaries.filter((summary) => summary.completedCount > 0).length,
  };
}
