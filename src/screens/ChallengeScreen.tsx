import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { Lucide } from '../components/Icon';
import { ErrorState } from '../components/ErrorState';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import {
  BADGE_TIERS,
  BADGE_TRACKS,
  BadgeTier,
  TIER_TARGETS,
  getBadgeLevel,
  getCurrentAwardTier,
} from '../lib/badgeChallenges';
import {
  completeSelfChallenge,
  getVisibleChallengeChoices,
  resolveChallengeTitle,
  requiresOtherPlayer,
  setCurrentSelectedChallenge,
  useBadgeProgress,
  useChallengeChoices,
  type ChallengeCategory,
  type DbChallenge,
} from '../features/challenges';
import { getMonthlyMasterySummary, getTrackProgressSummaries } from '../features/challenges/progression';
import type { BadgeTrack } from '../lib/badgeChallenges';
import { ProductEvents, trackProductEvent } from '../lib/analytics';

type TopTab = 'challenges' | 'badges';
type ChallengeCooldownReason = 'forfeit' | 'soloComplete';

interface ChallengeScreenProps {
  hideTabBar?: boolean;
}

const CHALLENGE_COOLDOWN_MS = 60000;

const TRACK_ROWS = [
  BADGE_TRACKS.slice(0, 4),
  BADGE_TRACKS.slice(4, 8),
];

function formatEarnedMonth(value: string | null | undefined, lang: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-US', {
    month: 'short',
    year: 'numeric',
  });
}

interface EarnedBadgeCardProps {
  badge: BadgeTrack;
  tier: BadgeTier;
  earnedAt: string;
  isLatest: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  tierLabel: (tier: BadgeTier) => string;
  trackName: (badge: BadgeTrack) => string;
  s: (key: string, ...args: string[]) => string;
  lang: string;
}

function EarnedBadgeCard({
  badge,
  tier,
  earnedAt,
  isLatest,
  styles,
  colors,
  tierLabel,
  trackName,
  s,
  lang,
}: EarnedBadgeCardProps) {
  const scale = useRef(new Animated.Value(isLatest ? 0.94 : 1)).current;
  const opacity = useRef(new Animated.Value(isLatest ? 0 : 1)).current;

  useEffect(() => {
    if (!isLatest) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 105,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLatest, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.wonCard,
        isLatest && { borderColor: badge.color },
        { opacity, transform: [{ scale }] },
      ]}
    >
      <View style={[styles.wonIcon, { backgroundColor: badge.color }]}>
        <View style={styles.wonIconHalo} />
        <Lucide name={badge.icon} size={23} color={colors.textOnPrimary} />
        <View style={[styles.wonTierSeal, { backgroundColor: colors.bgAlt }]}>
          <Lucide name="medal" size={12} color={badge.color} />
        </View>
      </View>
      <View style={styles.wonCopy}>
        <View style={styles.wonTitleRow}>
          <Text style={styles.wonTitle}>{tierLabel(tier)} {trackName(badge)}</Text>
          {isLatest ? (
            <View style={[styles.newBadgePill, { backgroundColor: badge.paleColor }]}>
              <Text style={[styles.newBadgePillText, { color: badge.color }]}>{s('newBadge')}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.wonDateRow}>
          <Lucide name="calendar-check" size={13} color={colors.textMuted} />
          <Text style={styles.wonMeta}>{s('challengeEarnedMonth', formatEarnedMonth(earnedAt, lang))}</Text>
        </View>
        <Text style={styles.wonSubMeta}>{s('challengeCompletedCount', String(TIER_TARGETS[tier]))}</Text>
      </View>
    </Animated.View>
  );
}

export function ChallengeScreen({ hideTabBar = false }: ChallengeScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { s, lang } = useI18n();
  const { user } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [topTab, setTopTab] = useState<TopTab>('challenges');
  const [activeBadgeId, setActiveBadgeId] = useState(BADGE_TRACKS[0].id);
  const [selectedChallenge, setSelectedChallenge] = useState<DbChallenge | null>(null);
  const [lockedChallengeId, setLockedChallengeId] = useState<string | null>(null);
  const [challengeCooldown, setChallengeCooldown] = useState<{ challengeId: string; endsAt: number; reason: ChallengeCooldownReason } | null>(null);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [actionChallengeId, setActionChallengeId] = useState<string | null>(null);
  const [completedSessionChallengeIds, setCompletedSessionChallengeIds] = useState<Set<string>>(new Set());
  const [earnedBadgeModal, setEarnedBadgeModal] = useState<{ badge: BadgeTrack; tier: BadgeTier } | null>(null);
  const ballBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (params.tab === 'badges') {
      setTopTab('badges');
    } else if (params.tab === 'challenges') {
      setTopTab('challenges');
    }
  }, [params.tab]);

  useEffect(() => {
    if (!challengeCooldown) return;

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((challengeCooldown.endsAt - Date.now()) / 1000));
      setCooldownRemainingSeconds(remaining);
      if (remaining <= 0) {
        setChallengeCooldown(null);
        setSelectedChallenge(null);
        setLockedChallengeId(null);
        setCurrentSelectedChallenge(null);
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [challengeCooldown]);

  useEffect(() => {
    if (!challengeCooldown) {
      ballBounce.stopAnimation();
      ballBounce.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ballBounce, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ballBounce, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    ballBounce.setValue(0);
    animation.start();
    return () => animation.stop();
  }, [ballBounce, challengeCooldown]);

  const activeBadge = BADGE_TRACKS.find((badge) => badge.id === activeBadgeId) ?? BADGE_TRACKS[0];
  const activeCategory = activeBadge.category as ChallengeCategory;
  const {
    approvedCompletions,
    approvedChallengeIds,
    badgeAwards,
    pendingChallengeIds,
    progressByCategory,
    refresh: refreshProgress,
    progressRows,
    error: progressError,
  } = useBadgeProgress(user?.id);
  const {
    choices: challengeChoices,
    error: choicesError,
    isLoading,
    refresh: refreshChoices,
  } = useChallengeChoices(activeCategory, { visibleCount: 20 });
  const trackSummaries = useMemo(
    () => getTrackProgressSummaries(progressRows, badgeAwards),
    [badgeAwards, progressRows],
  );
  const monthlyMastery = useMemo(
    () => getMonthlyMasterySummary(trackSummaries),
    [trackSummaries],
  );
  const visibleChallengeChoices = useMemo(
    () => getVisibleChallengeChoices(
      challengeChoices,
      new Set([...pendingChallengeIds, ...approvedChallengeIds]),
      completedSessionChallengeIds,
    ),
    [approvedChallengeIds, challengeChoices, completedSessionChallengeIds, pendingChallengeIds]
  );
  const completedCount = progressByCategory.get(activeCategory)?.completed_count ?? 0;
  const currentAwardTier = getCurrentAwardTier(completedCount);
  const currentTarget = TIER_TARGETS[currentAwardTier];
  const currentProgress = Math.min(completedCount, currentTarget);
  const progressWidth = `${Math.min(100, (currentProgress / currentTarget) * 100)}%` as `${number}%`;
  const tierLabel = (tier: BadgeTier) => s(`challengeTier${tier[0].toUpperCase()}${tier.slice(1)}`);
  const badgeLevelLabel = (count: number) => s(`challengeLevel${getBadgeLevel(count)}`);
  const trackName = (badge = activeBadge) => s(`badgeTrack_${badge.id}_name`);
  const trackShortName = (badge = activeBadge) => s(`badgeTrack_${badge.id}_short`);
  const trackDescription = (badge = activeBadge) => s(`badgeTrack_${badge.id}_desc`);
  const challengeTitle = (challenge: DbChallenge) => resolveChallengeTitle(s, challenge);
  const verificationLabel = (challenge: DbChallenge) => (
    requiresOtherPlayer(challenge) ? s('challengeVerificationOther') : s('challengeVerificationSelf')
  );
  const fallbackEarnedAtByBadgeTier = useMemo(() => {
    const grouped = new Map<ChallengeCategory, { completedAt: string }[]>();
    approvedCompletions.forEach((completion) => {
      const challengeRelation = completion.challenges;
      const category = Array.isArray(challengeRelation)
        ? challengeRelation[0]?.category
        : challengeRelation?.category;
      if (!category) return;
      const completedAt = completion.reviewed_at ?? completion.submitted_at;
      const entries = grouped.get(category) ?? [];
      entries.push({ completedAt });
      grouped.set(category, entries);
    });

    const earnedMap = new Map<string, string>();
    grouped.forEach((entries, category) => {
      const sorted = [...entries].sort((a, b) => (
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
      ));
      BADGE_TIERS.forEach((tier) => {
        const earnedAt = sorted[TIER_TARGETS[tier] - 1]?.completedAt;
        if (earnedAt) earnedMap.set(`${category}:${tier}`, earnedAt);
      });
    });
    return earnedMap;
  }, [approvedCompletions]);
  const earnedAtByBadgeTier = useMemo(() => {
    const earnedMap = new Map(fallbackEarnedAtByBadgeTier);
    badgeAwards.forEach((award) => {
      earnedMap.set(`${award.category}:${award.tier}`, award.awarded_at);
    });
    return earnedMap;
  }, [badgeAwards, fallbackEarnedAtByBadgeTier]);
  const latestEarnedBadgeKey = useMemo(() => {
    let latestKey = '';
    let latestTime = 0;
    earnedAtByBadgeTier.forEach((earnedAt, key) => {
      const time = new Date(earnedAt).getTime();
      if (time > latestTime) {
        latestKey = key;
        latestTime = time;
      }
    });
    return latestKey;
  }, [earnedAtByBadgeTier]);
  const selectedChallengeLocked = !!selectedChallenge && lockedChallengeId === selectedChallenge.id;
  const selectedChallengeCoolingDown = !!selectedChallenge && challengeCooldown?.challengeId === selectedChallenge.id;
  const cooldownTimerLabel = `${Math.floor(cooldownRemainingSeconds / 60)}:${String(cooldownRemainingSeconds % 60).padStart(2, '0')}`;
  const cooldownProgressWidth = `${Math.max(0, Math.min(100, (cooldownRemainingSeconds / (CHALLENGE_COOLDOWN_MS / 1000)) * 100))}%` as `${number}%`;
  const ballTranslateX = ballBounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-104, 104, -104],
  });
  const ballTranslateY = ballBounce.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -34, 0, -34, 0],
  });
  const ballScaleX = ballBounce.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 1, 1, 1, 1],
  });
  const ballScaleY = ballBounce.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 1, 1, 1, 1],
  });
  const ballShadowTranslateX = ballBounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-90, 90, -90],
  });
  const ballShadowOpacity = ballBounce.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.38, 0.14, 0.38, 0.14, 0.38],
  });

  const handleSelectBadge = (badgeId: string) => {
    setActiveBadgeId(badgeId);
    setSelectedChallenge(null);
    setLockedChallengeId(null);
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(null);
  };

  const handleSelectChallenge = (challenge: DbChallenge) => {
    setSelectedChallenge(challenge);
    setLockedChallengeId(null);
    setChallengeCooldown(null);
    if (requiresOtherPlayer(challenge)) {
      setCurrentSelectedChallenge(null);
    } else {
      setCurrentSelectedChallenge(challenge);
    }
    trackProductEvent(ProductEvents.challengeSelected, {
      challengeId: challenge.id,
      category: challenge.category,
      verificationType: challenge.verification_type,
    });
  };

  const handleSwitchChallenge = () => {
    setSelectedChallenge(null);
    setLockedChallengeId(null);
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(null);
  };

  const handleLockInChallenge = () => {
    if (!selectedChallenge) return;
    setLockedChallengeId(selectedChallenge.id);
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(selectedChallenge);
  };

  const handleForfeitChallenge = () => {
    if (!selectedChallenge) return;
    setLockedChallengeId(null);
    setCurrentSelectedChallenge(null);
    setChallengeCooldown({
      challengeId: selectedChallenge.id,
      endsAt: Date.now() + CHALLENGE_COOLDOWN_MS,
      reason: 'forfeit',
    });
    setCooldownRemainingSeconds(CHALLENGE_COOLDOWN_MS / 1000);
  };

  const handleComplete = async () => {
    if (!selectedChallenge || !user || requiresOtherPlayer(selectedChallenge)) return;
    const completedId = selectedChallenge.id;
    const previousCount = completedCount;
    const projectedCount = previousCount + 1;
    const earnedTier = BADGE_TIERS.find((tier) => TIER_TARGETS[tier] === projectedCount);
    const isNewBadgeAward = !!earnedTier && !earnedAtByBadgeTier.has(`${activeCategory}:${earnedTier}`);
    setActionChallengeId(completedId);
    try {
      const { error } = await completeSelfChallenge(completedId);
      if (error) {
        Alert.alert(s('error'), error.message);
        return;
      }

      setCompletedSessionChallengeIds((prev) => new Set(prev).add(completedId));
      setChallengeCooldown({
        challengeId: completedId,
        endsAt: Date.now() + CHALLENGE_COOLDOWN_MS,
        reason: 'soloComplete',
      });
      setCooldownRemainingSeconds(CHALLENGE_COOLDOWN_MS / 1000);
      setCurrentSelectedChallenge(null);
      await refreshProgress();
      await refreshChoices();
      trackProductEvent(ProductEvents.challengeCompleted, {
        challengeId: completedId,
        category: activeCategory,
        earnedTier,
      });
      if (earnedTier && isNewBadgeAward) {
        setEarnedBadgeModal({ badge: activeBadge, tier: earnedTier });
      }
    } finally {
      setActionChallengeId(null);
    }
  };

  const handleShareEarnedBadge = async () => {
    if (!earnedBadgeModal) return;
    await Share.share({
      message: s(
        'challengeBadgeShareMessage',
        tierLabel(earnedBadgeModal.tier),
        trackName(earnedBadgeModal.badge),
      ),
    });
  };

  const handleInviteVerification = async () => {
    if (!selectedChallenge || !user) return;
    setLockedChallengeId(selectedChallenge.id);
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(selectedChallenge);
    trackProductEvent(ProductEvents.challengeInviteStarted, {
      challengeId: selectedChallenge.id,
      category: activeBadge.category,
    });
    router.push({
      pathname: '/(protected)/create-event',
      params: {
        challengeId: selectedChallenge.id,
        challengeTrackId: activeBadge.id,
      },
    } as any);
  };

  const renderTrackPicker = () => (
    <View style={styles.trackPicker}>
      {TRACK_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.trackPickerRow}>
          {row.map((badge) => {
            const active = badge.id === activeBadge.id;
            const count = progressByCategory.get(badge.category as ChallengeCategory)?.completed_count ?? 0;
            return (
              <TouchableOpacity
                key={badge.id}
                style={[
                  styles.trackChip,
                  active && { backgroundColor: badge.color, borderColor: badge.color },
                ]}
                onPress={() => handleSelectBadge(badge.id)}
              >
                <Lucide name={badge.icon} size={17} color={active ? colors.textOnPrimary : badge.color} />
                <Text style={[styles.trackChipText, active && styles.trackChipTextActive]} numberOfLines={1}>
                  {trackShortName(badge)}
                </Text>
                <Text style={[styles.trackChipMeta, active && styles.trackChipMetaActive]}>{count}/15</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const renderCurrentProgress = () => (
    <View style={styles.progressPanel}>
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.eyebrow}>{s('challengeCurrentProgress')}</Text>
          <Text style={styles.progressTitle}>{tierLabel(currentAwardTier)}</Text>
        </View>
        <Text style={[styles.progressCount, { color: activeBadge.color }]}>
          {currentProgress}/{currentTarget}
        </Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: progressWidth, backgroundColor: activeBadge.color }]} />
      </View>
      <Text style={styles.progressHint}>
        {getBadgeLevel(completedCount) === 'Gold'
          ? s('challengeGoldEarned')
          : s('challengeMoreToEarn', String(currentTarget - currentProgress), tierLabel(currentAwardTier))}
      </Text>
    </View>
  );

  const renderMonthlyMastery = () => (
    <View style={styles.masteryPanel}>
      <View style={styles.masteryTop}>
        <View>
          <Text style={styles.eyebrow}>{s('challengeSeasonTitle')}</Text>
          <Text style={styles.masteryTitle}>{s('challengeSeasonSubtitle')}</Text>
        </View>
        <View style={styles.masteryScore}>
          <Text style={styles.masteryScoreValue}>{monthlyMastery.completed}</Text>
          <Text style={styles.masteryScoreLabel}>{s('challengeSeasonCompletions')}</Text>
        </View>
      </View>
      <View style={styles.masteryStats}>
        <View style={styles.masteryStat}>
          <Text style={styles.masteryStatValue}>{monthlyMastery.earnedThisMonth}</Text>
          <Text style={styles.masteryStatLabel}>{s('challengeSeasonBadges')}</Text>
        </View>
        <View style={styles.masteryStat}>
          <Text style={styles.masteryStatValue}>{monthlyMastery.tracksWithProgress}</Text>
          <Text style={styles.masteryStatLabel}>{s('challengeSeasonTracks')}</Text>
        </View>
        <View style={styles.masteryStat}>
          <Text style={styles.masteryStatValue}>{monthlyMastery.strongest.completedCount}/15</Text>
          <Text style={styles.masteryStatLabel}>{s(`badgeTrack_${monthlyMastery.strongest.badge.id}_short`)}</Text>
        </View>
      </View>
    </View>
  );

  const renderCooldownPanel = () => (
    <View style={styles.cooldownPanel} testID="challenge-cooldown-panel">
      <View style={styles.cooldownTableWrap}>
        <View style={styles.cooldownTable}>
          <View style={[styles.cooldownTableNet, { backgroundColor: activeBadge.color }]} />
        </View>
        <Animated.View
          style={[
            styles.cooldownBall,
            {
              transform: [
                { translateX: ballTranslateX },
                { translateY: ballTranslateY },
                { scaleX: ballScaleX },
                { scaleY: ballScaleY },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.cooldownBallShadow,
            {
              transform: [{ translateX: ballShadowTranslateX }],
              opacity: ballShadowOpacity,
            },
          ]}
        />
      </View>
      <View style={styles.cooldownInfoRow}>
        <View style={styles.cooldownCopy}>
          <View style={styles.cooldownTitleRow}>
            <Text style={styles.cooldownTitle}>{s('challengeCooldownTitle')}</Text>
          </View>
          <Text style={styles.cooldownText}>
            {challengeCooldown?.reason === 'soloComplete'
              ? s('challengeSoloCooldownDesc')
              : s('challengeForfeitCooldownDesc')}
          </Text>
        </View>
        <View style={[styles.cooldownTimerPill, { borderColor: activeBadge.color }]}>
          <Text style={[styles.cooldownTimer, { color: activeBadge.color }]}>{cooldownTimerLabel}</Text>
          <View style={styles.cooldownTimerTrack}>
            <View style={[styles.cooldownTimerFill, { width: cooldownProgressWidth, backgroundColor: activeBadge.color }]} />
          </View>
        </View>
      </View>
    </View>
  );

  const renderChallengesTab = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.sectionHeader, styles.centeredHeader]}>
        <Text style={styles.sectionTitle}>{s('challengeChooseTrack')}</Text>
      </View>
      {progressError ? (
        <ErrorState
          title={s('challengeProgressError')}
          description={s('challengeProgressErrorDesc')}
          ctaLabel={s('retry')}
          onRetry={refreshProgress}
        />
      ) : null}
      {renderTrackPicker()}

      <View style={[styles.heroCard, { borderColor: activeBadge.color }]}>
        <View style={[styles.heroIcon, { backgroundColor: activeBadge.paleColor }]}>
          <Lucide name={activeBadge.icon} size={28} color={activeBadge.color} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{trackName()}</Text>
          <Text style={styles.heroDesc}>{trackDescription()}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{badgeLevelLabel(completedCount)}</Text>
        </View>
      </View>

      {renderCurrentProgress()}

      {selectedChallenge ? (
        <View style={[styles.currentCard, { borderColor: activeBadge.color }]}>
          <Text style={styles.eyebrow}>{s('challengeSelected')}</Text>
          <Text style={styles.currentTitle}>{challengeTitle(selectedChallenge)}</Text>
          <View style={styles.verificationPanel}>
            <View style={[styles.verificationIcon, { backgroundColor: activeBadge.paleColor }]}>
              <Lucide
                name={requiresOtherPlayer(selectedChallenge) ? 'users' : 'check'}
                size={18}
                color={activeBadge.color}
              />
            </View>
            <View style={styles.verificationCopy}>
              <Text style={styles.verificationLabel}>{s('challengeVerification')}</Text>
              <Text style={styles.verificationValue}>{verificationLabel(selectedChallenge)}</Text>
              {requiresOtherPlayer(selectedChallenge) && (
                <Text style={styles.verificationNote}>
                  {s('challengeOtherVerificationNote')}
                </Text>
              )}
            </View>
          </View>
          {selectedChallengeCoolingDown ? (
            renderCooldownPanel()
          ) : requiresOtherPlayer(selectedChallenge) ? (
            <View style={styles.actions}>
              {selectedChallengeLocked ? (
                <TouchableOpacity style={styles.secondaryButton} onPress={handleForfeitChallenge} activeOpacity={0.86}>
                  <Lucide name="flag-off" size={16} color={colors.text} />
                  <Text style={styles.secondaryButtonText}>{s('challengeForfeit')}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.compactButton} onPress={handleSwitchChallenge} activeOpacity={0.86}>
                    <Lucide name="refresh-cw" size={15} color={colors.text} />
                    <Text style={styles.compactButtonText}>{s('challengeSwitch')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.compactButton, styles.lockButton, pendingChallengeIds.has(selectedChallenge.id) && styles.disabledButton]}
                    onPress={handleLockInChallenge}
                    disabled={pendingChallengeIds.has(selectedChallenge.id)}
                    activeOpacity={0.86}
                  >
                    <Lucide name="lock-keyhole" size={15} color={activeBadge.color} />
                    <Text style={[styles.compactButtonText, { color: activeBadge.color }]}>
                      {pendingChallengeIds.has(selectedChallenge.id) ? s('challengeAwaitingApproval') : s('challengeLockIn')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: activeBadge.color }, actionChallengeId && styles.disabledButton]}
                onPress={handleInviteVerification}
                disabled={!!actionChallengeId || pendingChallengeIds.has(selectedChallenge.id)}
                activeOpacity={0.88}
              >
                <Lucide name="calendar-plus" size={17} color={colors.textOnPrimary} />
                <Text style={styles.primaryButtonText}>
                  {pendingChallengeIds.has(selectedChallenge.id)
                    ? s('challengeAwaitingApproval')
                    : actionChallengeId === selectedChallenge.id
                      ? s('loading')
                      : s('challengeCreateEvent')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSwitchChallenge} activeOpacity={0.86}>
                <Lucide name="refresh-cw" size={16} color={colors.text} />
                <Text style={styles.secondaryButtonText}>{s('challengeSwitch')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: activeBadge.color }, actionChallengeId && styles.disabledButton]}
                onPress={handleComplete}
                disabled={!!actionChallengeId}
                activeOpacity={0.88}
              >
                <Lucide name="check" size={17} color={colors.textOnPrimary} />
                <Text style={styles.primaryButtonText}>
                  {actionChallengeId === selectedChallenge.id ? s('loading') : s('challengeComplete')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.challengeGrid}>
          {choicesError ? (
            <ErrorState
              title={s('challengeChoicesError')}
              description={s('challengeChoicesErrorDesc')}
              ctaLabel={s('retry')}
              onRetry={refreshChoices}
            />
          ) : isLoading ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>{s('loading')}</Text>
            </View>
          ) : visibleChallengeChoices.length > 0 ? visibleChallengeChoices.map((challenge) => (
            <TouchableOpacity
              key={challenge.id}
              testID={`challenge-card-${challenge.id}`}
              style={styles.challengeCard}
              onPress={() => handleSelectChallenge(challenge)}
            >
              <View style={[styles.challengeGlow, { backgroundColor: activeBadge.paleColor }]} />
              <View style={styles.challengeCardTop}>
                <View style={[styles.challengeIcon, { backgroundColor: activeBadge.paleColor }]}>
                  <Lucide
                    name={requiresOtherPlayer(challenge) ? 'users' : 'check'}
                    size={18}
                    color={activeBadge.color}
                  />
                </View>
                <View style={styles.verificationPill}>
                  <Text style={styles.verificationPillText}>
                    {s('challengeVerificationWithValue', verificationLabel(challenge))}
                  </Text>
                </View>
              </View>
              <Text style={styles.challengeTitle}>{challengeTitle(challenge)}</Text>
              <View style={styles.challengeFooter}>
                <Text style={[styles.challengeCta, { color: activeBadge.color }]}>{s('challengeSelect')}</Text>
                <Lucide name="arrow-right" size={16} color={activeBadge.color} />
              </View>
              <View style={[styles.challengeAccent, { backgroundColor: activeBadge.color }]} />
            </TouchableOpacity>
          )) : (
            <View style={styles.emptyPanel}>
              <Lucide name="check-circle" size={24} color={activeBadge.color} />
              <Text style={styles.emptyTitle}>{s('challengeTrackCleared')}</Text>
              <Text style={styles.emptyText}>{s('challengeTrackClearedDesc')}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderBadgesTab = () => {
    const wonBadges = BADGE_TRACKS.flatMap((badge) => (
      BADGE_TIERS.flatMap((tier) => {
        const earnedAt = earnedAtByBadgeTier.get(`${badge.category}:${tier}`);
        return earnedAt ? [{ badge, tier, earnedAt }] : [];
      })
    )).sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.sectionHeader, styles.centeredHeader]}>
          <Text style={styles.sectionTitle}>{s('challengeBadgeProgression')}</Text>
          <Text style={styles.sectionCopy}>{s('challengeBadgeProgressionDesc')}</Text>
        </View>
        {renderMonthlyMastery()}

        <View style={[styles.badgeFeature, { borderColor: activeBadge.color }]}>
          <View style={styles.badgeFeatureTop}>
            <View style={[styles.badgeFeatureIcon, { backgroundColor: activeBadge.color }]}>
              <View style={styles.badgeFeatureIconHalo} />
              <Lucide name={activeBadge.icon} size={32} color={colors.textOnPrimary} />
            </View>
            <View style={styles.badgeFeatureCopy}>
              <Text style={styles.eyebrow}>{s('challengeNextBadge')}</Text>
              <Text style={styles.badgeFeatureTitle}>{trackName()}</Text>
              <Text style={styles.badgeFeatureDesc}>{trackDescription()}</Text>
            </View>
            <View style={[styles.badgeFeatureCount, { backgroundColor: activeBadge.paleColor }]}>
              <Text style={[styles.badgeFeatureCountText, { color: activeBadge.color }]}>{completedCount}/15</Text>
            </View>
          </View>
          {renderCurrentProgress()}
          <View style={styles.milestoneRow}>
            {BADGE_TIERS.map((tier) => {
              const earnedAt = earnedAtByBadgeTier.get(`${activeCategory}:${tier}`);
              const won = !!earnedAt;
              return (
                <View
                  key={tier}
                  style={[
                    styles.milestone,
                    won && { borderColor: activeBadge.color, backgroundColor: activeBadge.paleColor },
                  ]}
                >
                  <View style={[styles.milestoneMedalWrap, won && { backgroundColor: activeBadge.color }]}>
                    <Lucide
                      name={won ? 'medal' : 'lock'}
                      size={17}
                      color={won ? colors.textOnPrimary : colors.textFaint}
                    />
                  </View>
                  <Text style={styles.milestoneLabel}>{tierLabel(tier)}</Text>
                  <Text style={styles.milestoneCount}>
                    {won && earnedAt
                      ? s('challengeEarnedMonth', formatEarnedMonth(earnedAt, lang))
                      : s('challengeLockedUntil', String(TIER_TARGETS[tier]))}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{s('challengeBadgesWon')}</Text>
          <Text style={styles.sectionCopy}>{s('challengeBadgesWonDesc')}</Text>
        </View>
        {wonBadges.length > 0 ? (
          <View style={styles.wonGrid}>
            {wonBadges.map(({ badge, tier, earnedAt }) => (
              <EarnedBadgeCard
                key={`${badge.id}-${tier}`}
                badge={badge}
                tier={tier}
                earnedAt={earnedAt}
                isLatest={`${badge.category}:${tier}` === latestEarnedBadgeKey}
                styles={styles}
                colors={colors}
                tierLabel={tierLabel}
                trackName={trackName}
                s={s}
                lang={lang}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Lucide name="award" size={24} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>{s('challengeNoBadgesWon')}</Text>
            <Text style={styles.emptyText}>{s('challengeNoBadgesWonDesc')}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('tabChallenge')}</Text>
        <NotificationBellButton color={headerFg} />
      </View>

      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.topTab, topTab === 'challenges' && styles.topTabActive]}
          onPress={() => setTopTab('challenges')}
        >
          <Text style={[styles.topTabText, topTab === 'challenges' && styles.topTabTextActive]}>{s('tabChallenge')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topTab, topTab === 'badges' && styles.topTabActive]}
          onPress={() => setTopTab('badges')}
        >
          <Text style={[styles.topTabText, topTab === 'badges' && styles.topTabTextActive]}>{s('badgesTitle')}</Text>
        </TouchableOpacity>
      </View>

      {topTab === 'challenges' ? renderChallengesTab() : renderBadgesTab()}
      <Modal
        visible={!!earnedBadgeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEarnedBadgeModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.badgeEarnedSheet}>
            {earnedBadgeModal ? (
              <>
                <View style={[styles.badgeEarnedIcon, { backgroundColor: earnedBadgeModal.badge.color }]}>
                  <Lucide name={earnedBadgeModal.badge.icon} size={34} color={colors.textOnPrimary} />
                </View>
                <Text style={styles.badgeEarnedTitle}>{s('challengeBadgeUnlocked')}</Text>
                <Text style={styles.badgeEarnedName}>
                  {tierLabel(earnedBadgeModal.tier)} {trackName(earnedBadgeModal.badge)}
                </Text>
                <Text style={styles.badgeEarnedCopy}>{s('challengeBadgeUnlockedDesc')}</Text>
                <View style={styles.badgeEarnedActions}>
                  <TouchableOpacity style={styles.badgeEarnedSecondary} onPress={() => setEarnedBadgeModal(null)}>
                    <Text style={styles.badgeEarnedSecondaryText}>{s('challengeKeepPlaying')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.badgeEarnedPrimary, { backgroundColor: earnedBadgeModal.badge.color }]}
                    onPress={handleShareEarnedBadge}
                  >
                    <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.badgeEarnedPrimaryText}>{s('challengeShareBadge')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? colors.bgAlt : colors.primary,
      paddingVertical: 10,
      minHeight: 52,
      paddingHorizontal: Spacing.md,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    topTabs: {
      flexDirection: 'row',
      padding: Spacing.sm,
      gap: Spacing.xs,
      backgroundColor: colors.bg,
    },
    topTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
    },
    topTabActive: {
      backgroundColor: colors.text,
    },
    topTabText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    topTabTextActive: {
      color: colors.bgAlt,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.md,
      gap: Spacing.md,
      paddingBottom: Spacing.xxl,
    },
    sectionHeader: {
      gap: 4,
    },
    centeredHeader: {
      alignItems: 'center',
    },
    sectionTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    sectionCopy: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
    },
    trackPicker: {
      gap: Spacing.xs,
    },
    trackPickerRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    trackChip: {
      flex: 1,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    trackChipText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    trackChipTextActive: {
      color: colors.textOnPrimary,
    },
    trackChipMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.textFaint,
    },
    trackChipMetaActive: {
      color: colors.textOnPrimary,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.md,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    heroIcon: {
      width: 54,
      height: 54,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: {
      flex: 1,
      gap: 3,
    },
    heroTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    heroDesc: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    statusPill: {
      borderRadius: Radius.sm,
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor: colors.bgMuted,
    },
    statusPillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    progressPanel: {
      alignSelf: 'stretch',
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    eyebrow: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    progressTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginTop: 2,
    },
    progressCount: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
    },
    progressBar: {
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      backgroundColor: colors.bgMuted,
    },
    progressFill: {
      height: 10,
      borderRadius: 5,
    },
    progressHint: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    masteryPanel: {
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: isDark ? colors.bgAlt : colors.text,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: isDark ? colors.primaryDim : colors.text,
      ...Shadows.md,
    },
    masteryTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    masteryTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.bgAlt,
      marginTop: 2,
    },
    masteryScore: {
      alignItems: 'flex-end',
    },
    masteryScoreValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.primaryLight,
    },
    masteryScoreLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.textMuted : colors.bgMuted,
    },
    masteryStats: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    masteryStat: {
      flex: 1,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? colors.bgMuted : '#ffffff18',
      padding: Spacing.sm,
      gap: 2,
    },
    masteryStatValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.bgAlt,
    },
    masteryStatLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.textMuted : colors.bgMuted,
    },
    approvalPanel: {
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    approvalCard: {
      flexDirection: 'row',
      gap: Spacing.sm,
      borderRadius: Radius.sm,
      backgroundColor: colors.bg,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    approvalIcon: {
      width: 38,
      height: 38,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenDeep,
    },
    approvalCopy: {
      flex: 1,
      gap: 6,
    },
    approvalTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    approvalMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    challengeGrid: {
      gap: Spacing.sm,
    },
    challengeCard: {
      position: 'relative',
      overflow: 'hidden',
      minHeight: 146,
      justifyContent: 'space-between',
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.sm,
    },
    challengeGlow: {
      position: 'absolute',
      top: -34,
      right: -28,
      width: 118,
      height: 118,
      borderRadius: 59,
      opacity: isDark ? 0.26 : 0.72,
    },
    challengeCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    challengeIcon: {
      width: 38,
      height: 38,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verificationPill: {
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    verificationPillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textMuted,
    },
    challengeTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      paddingRight: Spacing.sm,
      lineHeight: 23,
    },
    challengeFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    challengeCta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
    },
    challengeAccent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 4,
    },
    currentCard: {
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      padding: Spacing.lg,
      gap: Spacing.sm,
      ...Shadows.md,
    },
    currentTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    verificationPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgMuted,
      padding: Spacing.sm,
    },
    verificationIcon: {
      width: 42,
      height: 42,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verificationCopy: {
      flex: 1,
      gap: 2,
    },
    verificationLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    verificationValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    verificationNote: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    validationPicker: {
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgMuted,
      padding: Spacing.sm,
    },
    validationPickerTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    choiceList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    choicePill: {
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
    },
    choicePillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
      marginTop: Spacing.xs,
    },
    secondaryButton: {
      flex: 0.72,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 12,
      paddingVertical: 13,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    secondaryButtonText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 18,
    },
    compactButton: {
      flex: 0.84,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 9,
      paddingVertical: 12,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    lockButton: {
      backgroundColor: colors.bgMuted,
    },
    compactButtonText: {
      flexShrink: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 16,
    },
    primaryButton: {
      flex: 1.48,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 13,
      ...Shadows.sm,
    },
    primaryButtonText: {
      flexShrink: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
      textAlign: 'center',
      lineHeight: 18,
    },
    disabledButton: {
      opacity: 0.68,
    },
    cooldownPanel: {
      minHeight: 184,
      gap: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      padding: Spacing.md,
      marginTop: Spacing.xs,
      ...Shadows.sm,
    },
    cooldownTableWrap: {
      alignSelf: 'center',
      width: 230,
      height: 92,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    cooldownTable: {
      width: 178,
      height: 64,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ perspective: 220 }, { rotateX: '54deg' }],
      ...Shadows.sm,
    },
    cooldownTableNet: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      width: 2,
      borderRadius: 1,
      opacity: 0.84,
    },
    cooldownBall: {
      position: 'absolute',
      left: 106,
      top: 18,
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: isDark ? '#FFFFFF' : colors.borderLight,
      backgroundColor: '#FFFFFF',
      ...Shadows.sm,
    },
    cooldownBallShadow: {
      position: 'absolute',
      left: 103,
      bottom: 15,
      width: 24,
      height: 7,
      borderRadius: 4,
      backgroundColor: isDark ? '#00000055' : '#00000022',
    },
    cooldownInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    cooldownCopy: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    cooldownTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    cooldownTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      lineHeight: 22,
    },
    cooldownText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      lineHeight: 19,
    },
    cooldownTimerPill: {
      minWidth: 66,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.sm,
      borderWidth: 1,
      backgroundColor: colors.bgMuted,
      paddingVertical: 8,
      paddingHorizontal: 9,
      gap: 6,
    },
    cooldownTimer: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      lineHeight: 28,
    },
    cooldownTimerTrack: {
      width: 44,
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: isDark ? colors.bg : colors.borderLight,
    },
    cooldownTimerFill: {
      height: 4,
      borderRadius: 2,
    },
    badgeFeature: {
      overflow: 'hidden',
      gap: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.md,
    },
    badgeFeatureTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    badgeFeatureIcon: {
      width: 62,
      height: 62,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    badgeFeatureIconHalo: {
      position: 'absolute',
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: '#FFFFFF55',
    },
    badgeFeatureCopy: {
      flex: 1,
      gap: 3,
    },
    badgeFeatureTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    badgeFeatureDesc: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    badgeFeatureCount: {
      borderRadius: Radius.sm,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    badgeFeatureCountText: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
    },
    milestoneRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      alignSelf: 'stretch',
    },
    milestone: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bg,
      paddingVertical: 12,
      paddingHorizontal: 6,
      ...Shadows.sm,
    },
    milestoneMedalWrap: {
      width: 34,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgMuted,
    },
    milestoneLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    milestoneCount: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textFaint,
      textAlign: 'center',
    },
    wonGrid: {
      gap: Spacing.sm,
    },
    wonCard: {
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.md,
    },
    wonIcon: {
      width: 56,
      height: 56,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    wonIconHalo: {
      position: 'absolute',
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: '#FFFFFF55',
    },
    wonTierSeal: {
      position: 'absolute',
      right: -5,
      bottom: -5,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    wonCopy: {
      flex: 1,
      gap: 2,
    },
    wonTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    wonTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.xs,
    },
    wonMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    wonDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    wonSubMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    newBadgePill: {
      borderRadius: Radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    newBadgePillText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
    },
    emptyPanel: {
      alignItems: 'center',
      gap: 8,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    emptyTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    emptyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
      padding: Spacing.lg,
    },
    badgeEarnedSheet: {
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Shadows.lg,
    },
    badgeEarnedIcon: {
      width: 74,
      height: 74,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.md,
    },
    badgeEarnedTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    badgeEarnedName: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    badgeEarnedCopy: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    badgeEarnedActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignSelf: 'stretch',
      marginTop: Spacing.sm,
    },
    badgeEarnedSecondary: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: Spacing.sm,
    },
    badgeEarnedSecondaryText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    badgeEarnedPrimary: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      ...Shadows.sm,
    },
    badgeEarnedPrimaryText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
      textAlign: 'center',
    },
  });
}
