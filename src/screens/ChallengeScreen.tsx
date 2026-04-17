import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { Lucide } from '../components/Icon';
import { ErrorState } from '../components/ErrorState';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { createStyles } from './ChallengeScreen.styles';
import { EarnedBadgeModal } from './ChallengeScreen/EarnedBadgeModal';
import { BadgesTab } from './ChallengeScreen/BadgesTab';
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

  const renderBadgesTab = () => (
    <BadgesTab
      activeBadge={activeBadge}
      activeCategory={activeCategory}
      completedCount={completedCount}
      earnedAtByBadgeTier={earnedAtByBadgeTier}
      latestEarnedBadgeKey={latestEarnedBadgeKey}
      styles={styles}
      colors={colors}
      s={s}
      lang={lang}
      tierLabel={tierLabel}
      trackName={trackName}
      trackDescription={trackDescription}
      renderMonthlyMastery={renderMonthlyMastery}
      renderCurrentProgress={renderCurrentProgress}
    />
  );

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
      <EarnedBadgeModal
        data={earnedBadgeModal}
        styles={styles}
        colors={colors}
        tierLabel={tierLabel}
        trackName={trackName}
        s={s}
        onDismiss={() => setEarnedBadgeModal(null)}
        onShare={handleShareEarnedBadge}
      />
    </View>
  );
}
