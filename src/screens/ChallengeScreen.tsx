import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, RefreshControl, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { showAlert } from '../lib/dialogs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { FeedbackHeaderButton } from '../components/FeedbackHeaderButton';
import { BadgeTrackIcon } from '../components/BadgeTrackIcon';
import { Lucide } from '../components/Icon';
import { ErrorState } from '../components/ErrorState';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import { useSession } from '../hooks/useSession';
import { createStyles } from './ChallengeScreen.styles';
import { EarnedBadgeModal } from './ChallengeScreen/EarnedBadgeModal';
import { BadgesTab } from './ChallengeScreen/BadgesTab';
import { ExploreTab } from './ChallengeScreen/ExploreTab';
import {
  BADGE_TIERS,
  BADGE_TRACKS,
  BadgeTier,
  TIER_TARGETS,
  getBadgeLevel,
  getCurrentAwardTier,
  getBadgeTierPalette,
} from '../features/challenges/badgeDefinitions';
import {
  EXPLORER_QUEST_META,
  EXPLORER_TIERS,
  explorerTierEarned,
  useExplorerProgressQuery,
  type ExplorerProgress,
} from '../features/explorer';
import { useSelectedLocation } from '../hooks/useSelectedLocation';
import { getCityDisplayName } from '../lib/locationHelpers';
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
import type { BadgeTrack } from '../features/challenges/badgeDefinitions';
import { ProductEvents, trackProductEvent } from '../lib/analytics';

type TopTab = 'challenges' | 'badges' | 'explore';
type ChallengeCooldownReason = 'forfeit' | 'soloComplete';

interface ChallengeScreenProps {
  hideTabBar?: boolean;
}

const CHALLENGE_COOLDOWN_MS = 60000;

const TRACK_ROWS = [
  BADGE_TRACKS.slice(0, 4),
  BADGE_TRACKS.slice(4, 8),
];

interface CooldownTimerProps {
  endsAt: number;
  totalMs: number;
  color: string;
  trackStyle: any;
  pillStyle: any;
  fillStyle: any;
  textStyle: any;
  onElapsed: () => void;
}

// Owns the 1Hz tick locally so the parent ChallengeScreen doesn't re-render
// every second while a cooldown is active.
const CooldownTimer = React.memo(function CooldownTimer({
  endsAt,
  totalMs,
  color,
  trackStyle,
  pillStyle,
  fillStyle,
  textStyle,
  onElapsed,
}: CooldownTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
  );
  const elapsedFiredRef = useRef(false);

  useEffect(() => {
    elapsedFiredRef.current = false;
    const tick = () => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0 && !elapsedFiredRef.current) {
        elapsedFiredRef.current = true;
        onElapsed();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onElapsed]);

  const label = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const widthPct = `${Math.max(0, Math.min(100, (remaining / (totalMs / 1000)) * 100))}%` as `${number}%`;

  return (
    <View style={[pillStyle, { borderColor: color }]}>
      <Text style={[textStyle, { color }]}>{label}</Text>
      <View style={trackStyle}>
        <View style={[fillStyle, { width: widthPct, backgroundColor: color }]} />
      </View>
    </View>
  );
});

export function ChallengeScreen({ hideTabBar = false }: ChallengeScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { s, sn, lang } = useI18n();
  const { user } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { selectedCity } = useSelectedLocation();
  const selectedCityName = getCityDisplayName(selectedCity) || null;
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [topTab, setTopTab] = useState<TopTab>('challenges');
  const [activeBadgeId, setActiveBadgeId] = useState(BADGE_TRACKS[0].id);
  const [selectedChallenge, setSelectedChallenge] = useState<DbChallenge | null>(null);
  const [challengeCooldown, setChallengeCooldown] = useState<{ challengeId: string; endsAt: number; reason: ChallengeCooldownReason } | null>(null);
  const [actionChallengeId, setActionChallengeId] = useState<string | null>(null);
  const [completedSessionChallengeIds, setCompletedSessionChallengeIds] = useState<Set<string>>(new Set());
  const [earnedBadgeModal, setEarnedBadgeModal] = useState<{ badge: BadgeTrack; tier: BadgeTier } | null>(null);
  const ballBounce = useRef(new Animated.Value(0)).current;
  const challengesScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.tab === 'badges') {
      setTopTab('badges');
    } else if (params.tab === 'explore') {
      setTopTab('explore');
    } else if (params.tab === 'challenges') {
      setTopTab('challenges');
    }
  }, [params.tab]);

  // The 1Hz tick is owned by <CooldownTimer/>; this callback handles the
  // "cooldown elapsed" transition without re-rendering the parent every second.
  const handleCooldownElapsed = React.useCallback(() => {
    setChallengeCooldown(null);
    setSelectedChallenge(null);
    setCurrentSelectedChallenge(null);
  }, []);

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
  // F051: explorer-quest progress (city-scoped display; awards are lifetime).
  const {
    data: explorerQuests = [],
    isLoading: explorerLoading,
    isError: explorerError,
    refetch: refetchExplorer,
  } = useExplorerProgressQuery(user?.id, selectedCityName);
  // Pull-to-refresh + refetch-on-focus (T068): the postmortem removed
  // realtime in favor of fetch-on-focus, but this screen had neither.
  const [refreshing, setRefreshing] = useState(false);
  const focusedOnceRef = useRef(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProgress(), refreshChoices(), refetchExplorer()]);
    setRefreshing(false);
  }, [refreshProgress, refreshChoices, refetchExplorer]);

  useFocusEffect(
    React.useCallback(() => {
      if (!focusedOnceRef.current) {
        focusedOnceRef.current = true;
        return;
      }
      void refreshProgress();
      void refreshChoices();
      void refetchExplorer();
    }, [refreshProgress, refreshChoices, refetchExplorer]),
  );

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
  // F051: detect a newly-earned explorer tier when the progress query result
  // crosses a target on focus/refetch (NOT in a button handler — the count
  // changes server-side from a check-in elsewhere in the app). We snapshot the
  // earned set after the first settle so we never celebrate pre-existing
  // awards, then fire EarnedBadgeModal the first time a new tier flips on.
  const seenExplorerTiersRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (explorerLoading || explorerQuests.length === 0) return;
    const current = new Set<string>();
    explorerQuests.forEach((quest) => {
      EXPLORER_TIERS.forEach((tier) => {
        if (explorerTierEarned(quest, tier)) current.add(`${quest.key}:${tier}`);
      });
    });
    // First settle: record the baseline, celebrate nothing.
    if (seenExplorerTiersRef.current === null) {
      seenExplorerTiersRef.current = current;
      return;
    }
    const prev = seenExplorerTiersRef.current;
    // Find the first newly-flipped tier and celebrate it.
    for (const quest of explorerQuests) {
      for (const tier of EXPLORER_TIERS) {
        const sig = `${quest.key}:${tier}`;
        if (current.has(sig) && !prev.has(sig)) {
          const meta = EXPLORER_QUEST_META[quest.key];
          const pseudoBadge = {
            id: `explorer:${quest.key}`,
            category: `explorer_quest_${quest.key}`,
            name: s(`explorerQuest_${quest.key}_title`),
            shortName: s(`explorerQuest_${quest.key}_title`),
            icon: meta?.icon ?? 'compass',
            description: s(`explorerQuest_${quest.key}_desc`),
            color: meta?.color ?? colors.primary,
            paleColor: meta?.paleColor ?? colors.primaryPale,
            challenges: { bronze: [], silver: [], gold: [] },
          } as BadgeTrack;
          setEarnedBadgeModal({ badge: pseudoBadge, tier });
          seenExplorerTiersRef.current = current;
          return;
        }
      }
    }
    seenExplorerTiersRef.current = current;
  }, [explorerQuests, explorerLoading, s, colors.primary, colors.primaryPale]);

  // F051: "Find one" → jump to the map tab pre-filtered to the quest's predicate.
  const handleFindOne = React.useCallback((quest: ExplorerProgress) => {
    const filter = EXPLORER_QUEST_META[quest.key]?.mapFilter;
    router.push({
      pathname: '/(tabs)',
      params: {
        ...(filter ? { filter } : {}),
        ...(selectedCityName ? { city: selectedCityName } : {}),
      },
    });
  }, [router, selectedCityName]);

  // The pseudo-track name is carried on the badge itself, so the modal's
  // trackName resolver just returns it (explorer titles aren't badgeTrack_* keys).
  const resolveModalTrackName = React.useCallback(
    (badge: BadgeTrack) => (badge.id.startsWith('explorer:') ? badge.name : trackName(badge)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  );

  const selectedChallengeCoolingDown = !!selectedChallenge && challengeCooldown?.challengeId === selectedChallenge.id;
  // cooldownTimerLabel / cooldownProgressWidth now live inside <CooldownTimer/>.
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
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(null);
  };

  const handleSelectChallenge = (challenge: DbChallenge) => {
    setSelectedChallenge(challenge);
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(challenge);
    trackProductEvent(ProductEvents.challengeSelected, {
      challengeId: challenge.id,
      category: challenge.category,
      verificationType: challenge.verification_type,
    });
  };

  const handleSwitchChallenge = () => {
    setSelectedChallenge(null);
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(null);
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
        showAlert(s('error'), error.message);
        return;
      }

      setCompletedSessionChallengeIds((prev) => new Set(prev).add(completedId));
      setChallengeCooldown({
        challengeId: completedId,
        endsAt: Date.now() + CHALLENGE_COOLDOWN_MS,
        reason: 'soloComplete',
      });
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
        resolveModalTrackName(earnedBadgeModal.badge),
      ),
    });
  };

  const handleInviteVerification = async () => {
    if (!selectedChallenge || !user) return;
    setChallengeCooldown(null);
    setCurrentSelectedChallenge(selectedChallenge);
    trackProductEvent(ProductEvents.challengeInviteStarted, {
      challengeId: selectedChallenge.id,
      category: activeBadge.category,
    });
    router.push('/(tabs)/events');
  };

  const handleKeepSelected = () => {
    if (!selectedChallenge) return;
    setCurrentSelectedChallenge(selectedChallenge);
  };

  const handleCreateEventWithChallenge = () => {
    if (!selectedChallenge) return;
    setCurrentSelectedChallenge(selectedChallenge);
    router.push({ pathname: '/(protected)/create-event', params: { challengeId: selectedChallenge.id } });
  };

  const renderTrackPicker = () => (
    <View style={styles.trackPicker}>
      {TRACK_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.trackPickerRow}>
          {row.map((badge) => {
            const active = badge.id === activeBadge.id;
            const count = progressByCategory.get(badge.category as ChallengeCategory)?.completed_count ?? 0;
            const compactCurrentTier: BadgeTier = count >= TIER_TARGETS.silver
              ? 'gold'
              : count >= TIER_TARGETS.bronze
                ? 'silver'
                : 'bronze';
            const compactTierPalette = getBadgeTierPalette(compactCurrentTier);
            const compactTierStart = compactCurrentTier === 'bronze'
              ? 0
              : compactCurrentTier === 'silver'
                ? 5
                : 10;
            const compactTierCount = Math.max(0, Math.min(5, count - compactTierStart));
            const compactTierProgressWidth = `${(compactTierCount / 5) * 100}%` as `${number}%`;
            return (
              <TouchableOpacity
                key={badge.id}
                style={[
                  styles.trackChip,
                  active && { backgroundColor: badge.color, borderColor: badge.color },
                ]}
                onPress={() => handleSelectBadge(badge.id)}
              >
                <BadgeTrackIcon
                  badge={badge}
                  size={42}
                  variant="picker"
                  fallbackColor={active ? colors.textOnPrimary : badge.color}
                />
                <Text style={[styles.trackChipText, active && styles.trackChipTextActive]} numberOfLines={1}>
                  {trackShortName(badge)}
                </Text>
                <View
                  style={[
                    styles.trackChipProgressCard,
                    active && styles.trackChipProgressCardActive,
                  ]}
                >
                  <View style={styles.trackChipProgressHeader}>
                    <View style={[styles.trackChipProgressFlame, { backgroundColor: compactTierPalette.iconSurface }]}>
                      <Lucide name="flame" size={8} color={compactTierPalette.iconForeground} />
                    </View>
                    <Text
                      style={[
                        styles.trackChipProgressLabel,
                        { color: active ? colors.textOnPrimary : compactTierPalette.accent },
                      ]}
                    >
                      {tierLabel(compactCurrentTier)}
                    </Text>
                    <Text style={[styles.trackChipMeta, active && styles.trackChipMetaActive]}>
                      {compactTierCount}/5
                    </Text>
                  </View>
                  <View style={styles.trackChipProgressTrack}>
                    <View
                      style={[
                        styles.trackChipProgressFill,
                        {
                          width: compactTierProgressWidth,
                          backgroundColor: active ? colors.textOnPrimary : compactTierPalette.iconSurface,
                        },
                      ]}
                    />
                  </View>
                </View>
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
          : sn('challengeMoreToEarn', currentTarget - currentProgress, tierLabel(currentAwardTier))}
      </Text>
    </View>
  );

  const renderMonthlyMastery = () => {
    const strongestBadge = monthlyMastery.strongest.badge;
    const strongestProgress = Math.min(15, monthlyMastery.strongest.completedCount);
    const monthLabel = new Date().toLocaleDateString(getDateLocale(lang), {
      month: 'long',
      year: 'numeric',
    });

    return (
      <View style={styles.masteryPanel}>
        <View style={styles.masteryAccent} />
        <View style={styles.masteryTop}>
          <View style={styles.masteryTitleCol}>
            <View style={styles.masteryKickerRow}>
              <Text style={styles.eyebrow}>{s('challengeSeasonTitle')}</Text>
              <Text style={styles.masteryMonth}>{monthLabel}</Text>
            </View>
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
          <View style={[styles.masteryStat, styles.masteryStatFeatured]}>
            <Text style={styles.masteryStatValue}>{strongestProgress}/15</Text>
            <Text style={styles.masteryStatLabel}>{s(`badgeTrack_${strongestBadge.id}_short`)}</Text>
          </View>
        </View>
      </View>
    );
  };

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
        {challengeCooldown && (
          <CooldownTimer
            endsAt={challengeCooldown.endsAt}
            totalMs={CHALLENGE_COOLDOWN_MS}
            color={activeBadge.color}
            pillStyle={styles.cooldownTimerPill}
            textStyle={styles.cooldownTimer}
            trackStyle={styles.cooldownTimerTrack}
            fillStyle={styles.cooldownTimerFill}
            onElapsed={handleCooldownElapsed}
          />
        )}
      </View>
    </View>
  );

  const renderChallengesTab = () => (
    <ScrollView
      ref={challengesScrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
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
          <BadgeTrackIcon
            badge={activeBadge}
            size={64}
            variant="hero"
            fallbackColor={activeBadge.color}
          />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{trackName()}</Text>
          <Text style={styles.heroDesc}>{trackDescription()}</Text>
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
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={[styles.actionTile, styles.actionTilePrimary, { backgroundColor: activeBadge.color }, actionChallengeId && styles.disabledButton]}
                onPress={handleInviteVerification}
                disabled={!!actionChallengeId || pendingChallengeIds.has(selectedChallenge.id)}
                activeOpacity={0.88}
              >
                <Lucide name="calendar-plus" size={17} color={colors.textOnPrimary} />
                <Text style={styles.actionTilePrimaryText}>
                  {pendingChallengeIds.has(selectedChallenge.id)
                    ? s('challengeAwaitingApproval')
                    : actionChallengeId === selectedChallenge.id
                      ? s('loading')
                      : s('eventAddToEventShort')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTile} onPress={handleCreateEventWithChallenge} activeOpacity={0.86}>
                <Lucide name="plus-circle" size={16} color={colors.text} />
                <Text style={styles.actionTileText}>{s('challengeCreateEvent')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTile} onPress={handleKeepSelected} activeOpacity={0.86}>
                <Lucide name="check-circle" size={16} color={colors.text} />
                <Text style={styles.actionTileText}>{s('challengeSelect')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionTile} onPress={handleSwitchChallenge} activeOpacity={0.86}>
                <Lucide name="refresh-cw" size={16} color={colors.text} />
                <Text style={styles.actionTileText}>{s('challengeSwitch')}</Text>
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
                <View style={styles.challengeIcon}>
                  <BadgeTrackIcon
                    badge={activeBadge}
                    size={24}
                    variant="challenge-card"
                    fallbackColor={activeBadge.color}
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
      <TouchableOpacity
        style={[styles.switchTierButton, { borderColor: activeBadge.color, backgroundColor: activeBadge.paleColor }]}
        onPress={() => challengesScrollRef.current?.scrollTo({ y: 0, animated: true })}
        activeOpacity={0.88}
      >
        <Lucide name="arrow-up" size={17} color={activeBadge.color} />
        <Text style={[styles.switchTierButtonText, { color: activeBadge.color }]}>
          {s('challengeSwitchTier')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderExploreTab = () => (
    <ExploreTab
      quests={explorerQuests}
      cityName={selectedCityName}
      loading={explorerLoading}
      error={explorerError}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onFindOne={handleFindOne}
      styles={styles}
      colors={colors}
      s={s}
      sn={sn}
      tierLabel={tierLabel}
    />
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
      sn={sn}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <FeedbackHeaderButton color={headerFg} />
          <NotificationBellButton color={headerFg} />
        </View>
      </View>

      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.topTab, topTab === 'challenges' && styles.topTabActive]}
          onPress={() => setTopTab('challenges')}
        >
          <Text style={[styles.topTabText, topTab === 'challenges' && styles.topTabTextActive]}>{s('tabChallenge')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topTab, topTab === 'explore' && styles.topTabActive]}
          onPress={() => setTopTab('explore')}
          testID="explore-top-tab"
        >
          <Text style={[styles.topTabText, topTab === 'explore' && styles.topTabTextActive]}>{s('explorerTabTitle')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topTab, topTab === 'badges' && styles.topTabActive]}
          onPress={() => setTopTab('badges')}
        >
          <Text style={[styles.topTabText, topTab === 'badges' && styles.topTabTextActive]}>{s('badgesTitle')}</Text>
        </TouchableOpacity>
      </View>

      {topTab === 'challenges'
        ? renderChallengesTab()
        : topTab === 'explore'
          ? renderExploreTab()
          : renderBadgesTab()}
      <EarnedBadgeModal
        data={earnedBadgeModal}
        styles={styles}
        colors={colors}
        tierLabel={tierLabel}
        trackName={resolveModalTrackName}
        s={s}
        onDismiss={() => setEarnedBadgeModal(null)}
        onShare={handleShareEarnedBadge}
      />
    </View>
  );
}
