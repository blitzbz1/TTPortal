import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getUserApprovedChallengeCompletions,
  getUserBadgeAwards,
  getUserBadgeProgress,
  getUserPendingChallengeSubmissions,
} from '../api';
import { TIER_TARGETS } from '../../../lib/badgeChallenges';
import type {
  ApprovedChallengeCompletion,
  BadgeAward,
  BadgeLevel,
  ChallengeCategory,
  ChallengeSubmission,
  UserBadgeProgress,
} from '../types';

function isMissingBadgeAwardsTable(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === '42P01' || /badge_awards/i.test(candidate?.message ?? '');
}

function getCompletionCategory(completion: ApprovedChallengeCompletion) {
  const challengeRelation = completion.challenges;
  return Array.isArray(challengeRelation)
    ? challengeRelation[0]?.category
    : challengeRelation?.category;
}

function getMonthlyBadgeLevel(completedCount: number): BadgeLevel {
  if (completedCount >= TIER_TARGETS.gold) return 'gold';
  if (completedCount >= TIER_TARGETS.silver) return 'silver';
  if (completedCount >= TIER_TARGETS.bronze) return 'bronze';
  return 'none';
}

function getMonthWindow(now: Date) {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(monthStart.getMonth() + 1);

  return {
    monthStart,
    nextMonthStart,
  };
}

export function buildMonthlyProgressRows(
  userId: string,
  storedProgressRows: UserBadgeProgress[],
  approvedCompletions: ApprovedChallengeCompletion[],
  now = new Date(),
) {
  if (!userId) return [];

  const { monthStart, nextMonthStart } = getMonthWindow(now);
  const countsByCategory = new Map<ChallengeCategory, number>();
  const lastCompletedAtByCategory = new Map<ChallengeCategory, string>();

  approvedCompletions.forEach((completion) => {
    const category = getCompletionCategory(completion);
    if (!category) return;

    const completedAt = completion.reviewed_at ?? completion.submitted_at;
    const completedDate = new Date(completedAt);
    if (
      Number.isNaN(completedDate.getTime())
      || completedDate < monthStart
      || completedDate >= nextMonthStart
    ) {
      return;
    }

    countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1);
    const previousLatest = lastCompletedAtByCategory.get(category);
    if (!previousLatest || new Date(completedAt).getTime() > new Date(previousLatest).getTime()) {
      lastCompletedAtByCategory.set(category, completedAt);
    }
  });

  const categories = new Set<ChallengeCategory>([
    ...storedProgressRows.map((row) => row.category),
    ...countsByCategory.keys(),
  ]);
  const nowIso = now.toISOString();

  return [...categories].map((category) => {
    const storedRow = storedProgressRows.find((row) => row.category === category);
    const completedCount = countsByCategory.get(category) ?? 0;

    return {
      id: storedRow?.id ?? `${userId}:${category}:monthly`,
      user_id: userId,
      category,
      completed_count: completedCount,
      approved_count: completedCount,
      xp: completedCount * 100,
      badge_level: getMonthlyBadgeLevel(completedCount),
      last_completed_at: lastCompletedAtByCategory.get(category) ?? null,
      created_at: storedRow?.created_at ?? nowIso,
      updated_at: storedRow?.updated_at ?? nowIso,
    } satisfies UserBadgeProgress;
  });
}

export function useBadgeProgress(userId?: string | null) {
  const [progressRows, setProgressRows] = useState<UserBadgeProgress[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<ChallengeSubmission[]>([]);
  const [approvedCompletions, setApprovedCompletions] = useState<ApprovedChallengeCompletion[]>([]);
  const [badgeAwards, setBadgeAwards] = useState<BadgeAward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    const [
      { data: progressData, error: progressError },
      { data: pendingData, error: pendingError },
      { data: approvedData, error: approvedError },
      { data: awardsData, error: awardsError },
    ] =
      await Promise.all([
        getUserBadgeProgress(userId),
        getUserPendingChallengeSubmissions(userId),
        getUserApprovedChallengeCompletions(userId),
        getUserBadgeAwards(userId),
      ]);
    setIsLoading(false);

    const nextError = progressError ?? pendingError ?? approvedError ?? (
      isMissingBadgeAwardsTable(awardsError) ? null : awardsError
    );
    if (nextError) {
      setError(nextError);
      return;
    }

    setProgressRows((progressData ?? []) as UserBadgeProgress[]);
    setPendingSubmissions((pendingData ?? []) as ChallengeSubmission[]);
    setApprovedCompletions((approvedData ?? []) as ApprovedChallengeCompletion[]);
    setBadgeAwards((awardsData ?? []) as BadgeAward[]);
  }, [userId]);

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setProgressRows([]);
      setPendingSubmissions([]);
      setApprovedCompletions([]);
      setBadgeAwards([]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    setIsLoading(true);
    setError(null);
    Promise.all([
      getUserBadgeProgress(userId),
      getUserPendingChallengeSubmissions(userId),
      getUserApprovedChallengeCompletions(userId),
      getUserBadgeAwards(userId),
    ]).then(([progressRes, pendingRes, approvedRes, awardsRes]) => {
      if (!alive) return;
      setIsLoading(false);
      const nextError = progressRes.error ?? pendingRes.error ?? approvedRes.error ?? (
        isMissingBadgeAwardsTable(awardsRes.error) ? null : awardsRes.error
      );
      if (nextError) {
        setError(nextError);
        return;
      }

      setProgressRows((progressRes.data ?? []) as UserBadgeProgress[]);
      setPendingSubmissions((pendingRes.data ?? []) as ChallengeSubmission[]);
      setApprovedCompletions((approvedRes.data ?? []) as ApprovedChallengeCompletion[]);
      setBadgeAwards((awardsRes.data ?? []) as BadgeAward[]);
    });

    return () => {
      alive = false;
    };
  }, [userId]);

  const monthlyProgressRows = useMemo(
    () => buildMonthlyProgressRows(userId ?? '', progressRows, approvedCompletions),
    [approvedCompletions, progressRows, userId],
  );

  const progressByCategory = useMemo(() => {
    const byCategory = new Map<ChallengeCategory, UserBadgeProgress>();
    monthlyProgressRows.forEach((row) => byCategory.set(row.category, row));
    return byCategory;
  }, [monthlyProgressRows]);

  const pendingChallengeIds = useMemo(
    () => new Set(pendingSubmissions.map((submission) => submission.challenge_id)),
    [pendingSubmissions],
  );

  return {
    error,
    approvedCompletions,
    badgeAwards,
    isLoading,
    pendingChallengeIds,
    pendingSubmissions,
    progressByCategory,
    progressRows: monthlyProgressRows,
    allTimeProgressRows: progressRows,
    refresh,
  };
}
