import {
  BADGE_TIERS,
  BADGE_TRACKS,
  TIER_TARGETS,
  getBadgeLevel,
  getCurrentAwardTier,
  type BadgeTier,
  type BadgeTrack,
} from './badgeDefinitions';
import type { ApprovedChallengeCompletion, BadgeAward, ChallengeCategory, UserBadgeProgress } from './types';

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

function getCompletionCategory(completion: ApprovedChallengeCompletion) {
  const challengeRelation = completion.challenges;
  return Array.isArray(challengeRelation)
    ? challengeRelation[0]?.category
    : challengeRelation?.category;
}

export function getEarnedAtByBadgeTier(
  approvedCompletions: ApprovedChallengeCompletion[],
  badgeAwards: BadgeAward[],
  progressRows: UserBadgeProgress[] = [],
) {
  const grouped = new Map<ChallengeCategory, Map<string, { completedAt: string }[]>>();
  approvedCompletions.forEach((completion) => {
    const category = getCompletionCategory(completion);
    if (!category) return;
    const completedAt = completion.reviewed_at ?? completion.submitted_at;
    const completedDate = new Date(completedAt);
    if (Number.isNaN(completedDate.getTime())) return;

    const monthKey = `${completedDate.getUTCFullYear()}-${String(completedDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const byMonth = grouped.get(category) ?? new Map<string, { completedAt: string }[]>();
    const entries = byMonth.get(monthKey) ?? [];
    entries.push({ completedAt });
    byMonth.set(monthKey, entries);
    grouped.set(category, byMonth);
  });

  const earnedMap = new Map<string, string>();
  grouped.forEach((byMonth, category) => {
    const monthKeys = [...byMonth.keys()].sort();
    monthKeys.forEach((monthKey) => {
      const sorted = [...(byMonth.get(monthKey) ?? [])].sort((a, b) => (
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
      ));
      BADGE_TIERS.forEach((tier) => {
        const key = `${category}:${tier}`;
        const earnedAt = sorted[TIER_TARGETS[tier] - 1]?.completedAt;
        if (earnedAt && !earnedMap.has(key)) earnedMap.set(key, earnedAt);
      });
    });
  });

  progressRows.forEach((progress) => {
    BADGE_TIERS.forEach((tier) => {
      const key = `${progress.category}:${tier}`;
      if (progress.completed_count >= TIER_TARGETS[tier] && !earnedMap.has(key)) {
        earnedMap.set(key, progress.last_completed_at ?? progress.updated_at ?? progress.created_at);
      }
    });
  });

  badgeAwards.forEach((award) => {
    const key = `${award.category}:${award.tier}`;
    if (award.category === 'recruiter' || !earnedMap.has(key)) {
      earnedMap.set(key, award.awarded_at);
    }
  });

  return earnedMap;
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
