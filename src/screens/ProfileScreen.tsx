import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, RefreshControl, Modal, Pressable } from 'react-native';
import { showAlert, showConfirm } from '../lib/dialogs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { MessagesButton } from '../components/MessagesButton';
import { FeedbackHeaderButton } from '../components/FeedbackHeaderButton';
import { useTheme } from '../hooks/useTheme';
import { createStyles } from './ProfileScreen.styles';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import type { Profile } from '../types/database';
import { ProfileSkeleton } from '../components/SkeletonLoader';
import { ErrorState } from '../components/ErrorState';
import { useBadgeProgress } from '../features/challenges';
import { useProfileQuery, profileQueryKey, useProfileStatsQuery } from '../hooks/queries/useProfileQuery';
import { PlayProfileEditorModal } from '../components/PlayProfileEditorModal';
import { playGoalKey, skillLevelKey } from '../lib/playerAttributes';
import { usePlayerMatchesQuery, summarizeMatches, useRivalsQuery } from '../features/matches';
import { sendMatchInvite } from '../features/findPlayers';
import { usePlayerRatingQuery } from '../features/ratings';
import { RatingSparkline } from '../components/RatingSparkline';
import { RatingCelebrationSheet } from '../components/RatingCelebrationSheet';
import { MilestoneCelebrationSheet } from '../components/MilestoneCelebrationSheet';
import {
  useMilestonesQuery,
  MILESTONE_DEFS,
  milestoneCurrent,
  nextMilestoneGhost,
  yearsSince,
} from '../features/milestones';
import { QuickMatchModal } from '../components/QuickMatchModal';
import { LogTrainingModal } from '../components/LogTrainingModal';
import { VenuePickerModal } from '../components/VenuePickerModal';
import { getLastSeenRating, setLastSeenRating, shouldCelebrateRating } from '../lib/ratingsCache';
import { useHomeVenueQuery, useHomeVenueSuggestionQuery, homeVenueQueryKey } from '../features/venueIntel';
import { useCoachProfileQuery } from '../features/coaches';
import { isWrappedWindowOpen, wrappedYearFor } from '../features/wrapped';
import { updateProfile } from '../services/profiles';
import { useQueryClient } from '@tanstack/react-query';
import { playerUrl } from '../lib/shareLinks';

interface ProfileScreenProps {
  hideTabBar?: boolean;
}

export function ProfileScreen({ hideTabBar = false }: ProfileScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { s } = useI18n();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [quickMatchVisible, setQuickMatchVisible] = useState(false);
  const [trainingVisible, setTrainingVisible] = useState(false);
  const [homeVenuePickerVisible, setHomeVenuePickerVisible] = useState(false);
  const { data: matches = [], refetch: refetchMatches } = usePlayerMatchesQuery(user?.id);
  const matchRecord = useMemo(() => summarizeMatches(matches, user?.id ?? ''), [matches, user?.id]);

  // F031: rivals (most-played opponents) + Challenge.
  const { data: rivals = [] } = useRivalsQuery(user?.id);
  const [challengedRivals, setChallengedRivals] = useState<Set<string>>(new Set());
  const [rivalsExpanded, setRivalsExpanded] = useState(false);
  const challengeRival = useCallback(async (rivalId: string) => {
    setChallengedRivals((prev) => new Set(prev).add(rivalId));
    const { error } = await sendMatchInvite(rivalId);
    if (error) {
      setChallengedRivals((prev) => { const n = new Set(prev); n.delete(rivalId); return n; });
      showAlert(s('error'), s('genericError'));
    }
  }, [s]);
  useEffect(() => {
    if (rivals.length <= 3) setRivalsExpanded(false);
  }, [rivals.length]);

  // F030: rating + celebration on rating-up.
  const { data: rating, refetch: refetchRating } = usePlayerRatingQuery(user?.id);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!user?.id || rating?.rating == null) return;
    const lastSeen = getLastSeenRating(user.id);
    if (shouldCelebrateRating(rating.rating, lastSeen)) setCelebrate(true);
    setLastSeenRating(user.id, rating.rating);
  }, [user?.id, rating?.rating]);

  const {
    progressRows,
  } = useBadgeProgress(user?.id);

  // F050: weekly play streak (rides get_profile_stats; migration 126).
  const { data: profileStats, refetch: refetchProfileStats } = useProfileStatsQuery(user?.id);
  const currentStreak = profileStats?.current_streak ?? 0;
  const bestStreak = profileStats?.best_streak ?? 0;
  const [streakDetailVisible, setStreakDetailVisible] = useState(false);

  // F054: TT Wrapped: the year-in-review banner only shows inside the
  // Dec 15 - Jan 15 window; tapping it opens the swipeable story.
  const wrappedOpen = isWrappedWindowOpen();
  const wrappedYear = wrappedYearFor();

  // F053: lifetime milestones: earned set + the next locked "ghost" + a
  // full-screen celebration when a NEW milestone appears (e.g. crossed via a
  // review, an event, or the anniversary cron and surfaced on focus/refetch).
  const { data: milestones = [], isLoading: milestonesLoading } = useMilestonesQuery(user?.id);
  const earnedKeys = useMemo(
    () => new Set(milestones.map((m) => m.milestone_key)),
    [milestones],
  );
  const milestoneCounters = useMemo(
    () => ({
      checkins: profileStats?.total_checkins ?? 0,
      venues: profileStats?.unique_venues ?? 0,
      // Combined check-in + event hours: matches what the hours milestones are
      // awarded against (NOT the event-only total_hours_played), so the ghost
      // progress agrees with the durable earned chip.
      hours: profileStats?.total_play_hours ?? 0,
      reviews: profileStats?.reviews_written ?? 0,
      years: yearsSince(profileStats?.member_since ?? null),
    }),
    [profileStats],
  );
  const milestoneGhost = useMemo(
    () => nextMilestoneGhost(earnedKeys, milestoneCounters),
    [earnedKeys, milestoneCounters],
  );
  // Diff the earned set on focus/refetch (like the explorer-quest tier
  // detection in ChallengeScreen): record a baseline, then celebrate the first
  // newly-flipped key. The check-in flow has its OWN stacked celebration, so
  // this catches review/anniversary/event-driven crossings.
  const seenMilestonesRef = React.useRef<Set<string> | null>(null);
  const [celebrateMilestoneKey, setCelebrateMilestoneKey] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    // Wait for the first SETTLED fetch before snapshotting the baseline. On a
    // cold cache initialData is undefined, so earnedKeys is momentarily empty;
    // capturing the baseline then would make every pre-existing milestone look
    // "newly flipped" and fire a bogus celebration once the real data arrives.
    // (Mirrors ChallengeScreen's explorer-tier loading guard.)
    if (milestonesLoading) return;
    if (seenMilestonesRef.current === null) {
      seenMilestonesRef.current = new Set(earnedKeys);
      return;
    }
    const prev = seenMilestonesRef.current;
    for (const def of MILESTONE_DEFS) {
      if (earnedKeys.has(def.key) && !prev.has(def.key)) {
        setCelebrateMilestoneKey(def.key);
        break;
      }
    }
    seenMilestonesRef.current = new Set(earnedKeys);
  }, [earnedKeys, user?.id, milestonesLoading]);

  // T050: react-query owns fetch + persistent-cache hydration (the hook
  // mirrors to profileCache and seeds initialData from it). The old
  // loadCached -> setState -> fetch -> saveCached orchestration is gone.
  const {
    data: profileRaw,
    isLoading,
    isError,
    refetch: refetchProfile,
  } = useProfileQuery(user?.id);
  const profile = useMemo(
    () =>
      profileRaw
        ? // email is no longer served by profiles (migration 085); the session
          // user is the source of truth for the caller's own address.
          ({ ...profileRaw, email: user?.email ?? null } as Profile)
        : null,
    [profileRaw, user?.email],
  );
  const loading = isLoading && !profile;
  const profileError = isError && !profile;
  const [refreshing, setRefreshing] = useState(false);
  const refreshProfileScreen = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchProfile(),
        refetchProfileStats(),
        refetchMatches(),
        refetchRating(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchMatches, refetchProfile, refetchProfileStats, refetchRating]);

  // F014: home venue ("plays at X") + auto-suggestion when none is set yet.
  const queryClient = useQueryClient();
  const { data: homeVenue } = useHomeVenueQuery(user?.id);
  // F063: the user's own coach application (drives the "I coach" entry label).
  const { data: coachProfile } = useCoachProfileQuery(user?.id);
  const { data: homeSuggestion } = useHomeVenueSuggestionQuery(
    user?.id,
    !!profileRaw && (profileRaw as any).home_venue_id == null,
  );
  const acceptHomeSuggestion = useCallback(async () => {
    if (!user || !homeSuggestion) return;
    await updateProfile(user.id, { home_venue_id: homeSuggestion.id });
    queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    queryClient.invalidateQueries({ queryKey: homeVenueQueryKey(user.id) });
  }, [user, homeSuggestion, queryClient]);

  const fullName = user?.user_metadata?.full_name || profile?.full_name || '';
  const nameParts = fullName.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : (nameParts[0]?.[0] || '?').toUpperCase();

  const username = profile?.username ? `@${profile.username}` : '';
  const city = profile?.city || '';
  const usernameDisplay = [username, city].filter(Boolean).join(' \u00B7 ');
  const completedChallengeCount = useMemo(
    () => progressRows.reduce((total, row) => total + row.approved_count, 0),
    [progressRows],
  );
  const visibleRivals = rivalsExpanded ? rivals : rivals.slice(0, 3);
  const hiddenRivalCount = Math.max(rivals.length - visibleRivals.length, 0);
  const milestoneHighlights = useMemo(() => {
    const metricOrder: Record<string, number> = {
      checkins: 0,
      hours: 1,
      venues: 2,
      reviews: 3,
      anniversary: 4,
    };
    const byMetric = new Map<string, {
      current: number;
      def: (typeof MILESTONE_DEFS)[number];
      ghost: boolean;
    }>();

    MILESTONE_DEFS.forEach((def) => {
      const current = milestoneCurrent(def, milestoneCounters);
      if (!earnedKeys.has(def.key)) return;
      const existing = byMetric.get(def.metric);
      if (!existing || def.threshold > existing.def.threshold) {
        byMetric.set(def.metric, { def, current, ghost: false });
      }
    });

    if (milestoneGhost && !byMetric.has(milestoneGhost.def.metric)) {
      byMetric.set(milestoneGhost.def.metric, {
        def: milestoneGhost.def,
        current: milestoneGhost.current,
        ghost: true,
      });
    }

    return [...byMetric.values()]
      .sort((a, b) => {
        if (a.ghost !== b.ghost) return a.ghost ? 1 : -1;
        return (metricOrder[a.def.metric] ?? 99) - (metricOrder[b.def.metric] ?? 99);
      })
      .slice(0, 3);
  }, [earnedKeys, milestoneCounters, milestoneGhost]);
  const hasMilestoneContent = milestoneHighlights.length > 0;
  const displayRating = Math.round(rating?.rating ?? 1200);
  const peakRating = rating != null ? Math.round(rating.peak) : null;
  const displayPeak = peakRating != null && peakRating > 1200 && peakRating > displayRating
    ? peakRating
    : null;
  const ratingSparkPoints = rating?.spark && rating.spark.length >= 2
    ? rating.spark
    : [1200, 1200, 1200, 1200];

  const handleLogout = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm(s('confirmLogout'))) return;
      await signOut();
      router.replace('/sign-in');
    } else {
      if (await showConfirm(s('logout'), s('confirmLogout'), { confirmLabel: s('logout'), cancelLabel: s('cancel'), destructive: true })) {
        await signOut();
        router.replace('/sign-in');
      }
    }
  }, [signOut, router, s]);

  const setHomeVenue = useCallback(async (venue: { id: number; name: string } | null) => {
    if (!user) return;
    await updateProfile(user.id, { home_venue_id: venue?.id ?? null });
    setHomeVenuePickerVisible(false);
    queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    queryClient.invalidateQueries({ queryKey: homeVenueQueryKey(user.id) });
  }, [queryClient, user]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>{s('myProfile')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ProfileSkeleton />
        </View>
      </View>
    );
  }

  if (profileError && !profile) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>{s('myProfile')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ErrorState
          title={s('profileLoadError')}
          description={s('profileLoadErrorDesc')}
          ctaLabel={s('retry')}
          onRetry={refetchProfile}
        />
      </View>
    );
  }

  const renderPlayerOverviewCard = () => (
    <View style={styles.playerOverviewCard} testID="profile-player-overview-card">
      <View style={styles.playerOverviewRatingPanel}>
        <View style={styles.playerOverviewRatingHeader}>
          <View style={styles.playerOverviewRatingScore}>
            <Text style={styles.playerOverviewMetricLabel}>{s('ratingTitle')}</Text>
            <View style={styles.playerOverviewRatingLine}>
              <Text style={styles.playerOverviewRatingValue}>
                {displayRating}
              </Text>
            </View>
            <View style={styles.playerOverviewRatingBadges}>
              {displayPeak != null ? (
                <View style={styles.playerOverviewRatingBadge}>
                  <Text style={styles.playerOverviewRatingBadgeText}>
                    {s('ratingPeak')} {displayPeak}
                  </Text>
                </View>
              ) : null}
              {rating?.last5?.slice(-2).map((d, i) => (
                <View
                  key={`${i}-${d}`}
                  style={styles.playerOverviewRatingBadge}
                >
                  <Text style={[
                    styles.playerOverviewRatingBadgeText,
                    { color: d >= 0 ? colors.primary : colors.red },
                  ]}>
                    {d >= 0 ? `+${d}` : `${d}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.playerOverviewRatingSpark}>
            <RatingSparkline points={ratingSparkPoints} width={260} height={66} responsive />
          </View>
        </View>
        <TouchableOpacity
          style={styles.playerOverviewRatingCta}
          onPress={() => setQuickMatchVisible(true)}
          activeOpacity={0.78}
          testID="profile-rating-quick-match"
        >
          <View style={styles.playerOverviewRatingCtaIcon}>
            <Lucide name="qr-code" size={18} color={colors.textOnPrimary} />
          </View>
          <Text style={styles.playerOverviewRatingCtaText}>
            {s('quickMatchTitle')}
          </Text>
          <Lucide name="arrow-right" size={16} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.playerOverviewMatchStrip}>
        <Text style={styles.playerOverviewMetricLabel}>{s('matchesTitle')}</Text>
        <View style={styles.playerOverviewRecordCompact}>
          <Text style={[styles.playerOverviewRecordValue, { color: colors.primary }]}>{matchRecord.wins}</Text>
          <Text style={styles.playerOverviewRecordLabel}>{s('ladderWins')}</Text>
          <View style={styles.playerOverviewRecordDivider} />
          <Text style={[styles.playerOverviewRecordValue, { color: colors.red }]}>{matchRecord.losses}</Text>
          <Text style={styles.playerOverviewRecordLabel}>{s('lossesTitle')}</Text>
        </View>
      </View>

      <View style={styles.playerOverviewVenueRow}>
        <TouchableOpacity
          style={styles.playerOverviewVenueMain}
          onPress={() => setHomeVenuePickerVisible(true)}
          activeOpacity={0.75}
          testID={homeVenue ? 'profile-home-venue' : 'profile-home-venue-empty'}
          accessibilityRole="button"
          accessibilityLabel={homeVenue ? `${s('edit')}: ${s('homeVenueYours')}` : s('homeVenueChoose')}
        >
          <View style={styles.playerOverviewVenueIcon}>
            <Lucide name="map-pin" size={15} color={homeVenue ? colors.primary : colors.textFaint} />
          </View>
          <View style={styles.playerOverviewVenueCopy}>
            <Text style={styles.playerOverviewMetricLabel}>
              {homeVenue ? s('homeVenueYours') : s('homeVenueChoose')}
            </Text>
            <Text style={styles.playerOverviewVenueTitle} numberOfLines={1}>
              {homeVenue?.name ?? s('homeVenueChooseHint')}
            </Text>
          </View>
          <View style={styles.playerOverviewVenueAction}>
            <Lucide name={homeVenue ? 'pencil' : 'plus'} size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>
        {homeSuggestion && !homeVenue ? (
          <TouchableOpacity
            style={styles.playerOverviewVenueSuggestion}
            onPress={acceptHomeSuggestion}
            activeOpacity={0.75}
            testID="profile-home-venue-suggestion"
          >
            <Text style={styles.playerOverviewVenueSuggestionText} numberOfLines={1}>
              {s('homeVenueSuggested')}: {homeSuggestion.name}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {hasMilestoneContent ? (
        <View style={styles.playerOverviewMilestones} testID="profile-milestones-strip">
          <View style={styles.playerOverviewMilestoneRow}>
            {milestoneHighlights.map((item) => (
              <View
                key={`${item.ghost ? 'ghost' : 'earned'}-${item.def.key}`}
                style={[styles.playerOverviewMilestonePill, item.ghost && styles.playerOverviewGhostPill]}
                testID={item.ghost ? 'milestone-ghost' : `milestone-earned-${item.def.key}`}
              >
                <Lucide
                  name={item.ghost ? 'lock' : item.def.icon}
                  size={12}
                  color={item.ghost ? colors.textFaint : colors.primary}
                />
                <Text
                  style={[styles.playerOverviewMilestoneText, { color: item.ghost ? colors.textFaint : colors.primary }]}
                  numberOfLines={1}
                >
                  {item.ghost
                    ? `${s('milestoneGhostProgress', String(item.current), String(item.def.threshold))} - ${s(item.def.titleKey)}`
                    : s(item.def.titleKey)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.playerOverviewRivalsPanel}>
        <View style={styles.playerOverviewRivalsHeader}>
          <Text style={styles.playerOverviewMetricLabel}>{s('rivalsTitle')}</Text>
          {rivals.length === 0 ? (
            <Text style={styles.playerOverviewMetricMeta} numberOfLines={1}>
              {s('rivalsEmptyHint')}
            </Text>
          ) : null}
        </View>
        {visibleRivals.length > 0 ? (
          <View style={styles.playerOverviewRivalsList}>
            {visibleRivals.map((rival, index) => {
              const challenged = challengedRivals.has(rival.user_id);
              return (
                <View key={rival.user_id} style={styles.playerOverviewRivalRow}>
                  <TouchableOpacity
                    style={styles.playerOverviewRivalCopy}
                    onPress={() => router.push({ pathname: '/(protected)/player/[userId]', params: { userId: rival.user_id } })}
                    activeOpacity={0.75}
                  >
                    <View style={styles.playerOverviewRivalRank}>
                      <Text style={styles.playerOverviewRivalRankText}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.navLabel} numberOfLines={1}>{rival.full_name ?? s('user')}</Text>
                      <Text style={styles.playerOverviewMetricMeta}>
                        {rival.my_wins}{s('winShort')} - {rival.their_wins}{s('lossShort')} - {s('rivalMatchesCount', String(rival.total))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.playerOverviewChallengeButton,
                      challenged && styles.playerOverviewChallengeButtonDisabled,
                    ]}
                    disabled={challenged}
                    onPress={() => challengeRival(rival.user_id)}
                    accessibilityRole="button"
                    testID={`rival-challenge-${rival.user_id}`}
                  >
                    <Lucide
                      name={challenged ? 'check' : 'swords'}
                      size={13}
                      color={challenged ? colors.textMuted : colors.primary}
                    />
                    <Text style={[
                      styles.playerOverviewChallengeText,
                      challenged && { color: colors.textMuted },
                    ]}>
                      {challenged ? s('findPlayersChallengeSent') : s('findPlayersChallenge')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            {rivals.length > 3 ? (
              <TouchableOpacity
                style={styles.playerOverviewRivalsMore}
                onPress={() => setRivalsExpanded((current) => !current)}
                activeOpacity={0.76}
                accessibilityRole="button"
                testID="profile-rivals-toggle"
              >
                <Text style={styles.playerOverviewRivalsMoreText}>
                  {rivalsExpanded
                    ? s('profileShowLessBadges')
                    : `${s('profileShowMoreBadges')} (${s('rivalsMore', String(hiddenRivalCount)).replace(/^\+/, '')})`}
                </Text>
                <Lucide
                  name={rivalsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('myProfile')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <FeedbackHeaderButton color={headerFg} />
          <MessagesButton color={headerFg} />
          <NotificationBellButton color={headerFg} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshProfileScreen} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.profileSummaryCard}>
          <View style={styles.identityHeaderRow}>
            <View style={styles.identityHeaderIcon}>
              <Text style={styles.identityHeaderIconText}>{initials}</Text>
            </View>
            <View style={styles.identityHeaderCopy}>
              <Text style={styles.summaryName}>{fullName || s('user')}</Text>
              {usernameDisplay ? <Text style={styles.summaryHandle} numberOfLines={1}>{usernameDisplay}</Text> : null}
            </View>
            <View style={styles.summaryProgressRow}>
              <TouchableOpacity
                testID="profile-challenges-pill"
                style={styles.challengeChip}
                onPress={() => router.push({ pathname: '/(tabs)/challenges', params: { tab: 'badges' } })}
                activeOpacity={0.78}
              >
                <Lucide name="medal" size={11} color={colors.textOnPrimary} />
                <Text style={styles.challengeChipText}>
                  {completedChallengeCount} {s('profileChallengesCompleted')}
                </Text>
              </TouchableOpacity>
              {/* F050: weekly play streak flame chip (tap for current/best). */}
              {currentStreak > 0 ? (
                <TouchableOpacity
                  testID="profile-streak-chip"
                  style={styles.streakChip}
                  onPress={() => setStreakDetailVisible(true)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                >
                  <Lucide name="flame" size={11} color={colors.textOnPrimary} />
                  <Text style={styles.streakChipText}>{s('streakWeeks', currentStreak)}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <TouchableOpacity
            style={styles.summaryPlayRow}
            onPress={() => setEditorVisible(true)}
            testID="edit-play-profile"
            accessibilityRole="button"
            accessibilityLabel={s('edit')}
            activeOpacity={0.78}
          >
            <View style={styles.summaryPlayPills}>
              {profile?.skill_level ? (
                <View style={[styles.summaryGoalChip, styles.summarySkillChip]}>
                  <Text style={styles.summaryGoalChipText}>{s(skillLevelKey(profile.skill_level))}</Text>
                </View>
              ) : null}
              {(profile?.play_goals ?? []).map((g) => (
                <View key={g} style={styles.summaryGoalChip}>
                  <Text style={styles.summaryGoalChipText}>{s(playGoalKey(g))}</Text>
                </View>
              ))}
              {!profile?.skill_level && (profile?.play_goals?.length ?? 0) === 0 ? (
                <Text style={styles.summaryPlayEmpty}>{s('playProfileEmpty')}</Text>
              ) : null}
            </View>
            <View
              style={styles.summaryEditButton}
              testID="edit-play-profile-button"
            >
              <Lucide name="pencil" size={16} color={colors.textOnPrimary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* TT Wrapped (F054): year-in-review banner, only inside Dec 15 - Jan 15. */}
        {wrappedOpen ? (
          <TouchableOpacity
            style={styles.wrappedBanner}
            onPress={() => router.push({ pathname: '/wrapped', params: { year: String(wrappedYear) } })}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="profile-wrapped-banner"
          >
            <View style={styles.wrappedBannerIcon}>
              <Lucide name="gift" size={20} color={colors.primary} />
            </View>
            <View style={styles.wrappedBannerCopy}>
              <Text style={styles.wrappedBannerTitle}>{s('wrappedBannerTitle', String(wrappedYear))}</Text>
              <Text style={styles.wrappedBannerSubtitle}>{s('wrappedBannerCta')}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {renderPlayerOverviewCard()}

        {/* Navigation Links */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/friends')}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="users" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('friends')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => setTrainingVisible(true)} testID="profile-log-training">
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="dumbbell" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('trainingLogTitle')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/play-history')}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="trophy" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('playHistory')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/equipment')}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <MaterialCommunityIcons name="table-tennis" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('equipment')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push({ pathname: '/(protected)/coach-apply' })}
            testID="profile-i-coach"
          >
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="graduation-cap" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('coachIcoach')}</Text>
            {coachProfile?.status === 'approved' && (
              <View style={styles.adminPill}>
                <Text style={styles.adminPillText}>{s('coachChip')}</Text>
              </View>
            )}
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/favorites')}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="heart" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('favorites')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/leaderboard')}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="bar-chart-3" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('leaderboard')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/settings')}>
            <View style={[styles.navIcon, { backgroundColor: colors.bgMuted }]}>
              <Lucide name="settings" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.navLabel}>{s('settings')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>

          {(profile?.is_admin || profile?.is_moderator) && (
            <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/admin')}>
              <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
                <Lucide name="shield-check" size={18} color={colors.primaryMid} />
              </View>
              <Text style={styles.navLabel}>{s('moderation')}</Text>
              <View style={styles.adminPill}>
                <Text style={styles.adminPillText}>{s(profile?.is_admin ? 'admin' : 'moderator')}</Text>
              </View>
              <Lucide name="chevron-right" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Lucide name="log-out" size={18} color={colors.red} />
            <Text style={styles.logoutText}>{s('logout')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {user?.id && (
        <PlayProfileEditorModal
          visible={editorVisible}
          userId={user.id}
          initialSkill={profile?.skill_level ?? null}
          initialGoals={profile?.play_goals ?? []}
          onClose={() => setEditorVisible(false)}
          onSaved={refetchProfile}
        />
      )}

      {rating != null && (
        <RatingCelebrationSheet
          visible={celebrate}
          rating={rating.rating}
          delta={rating.last5[0] ?? 0}
          peak={rating.peak}
          matches={rating.matches}
          shareUrl={playerUrl(user?.id ?? '')}
          onClose={() => setCelebrate(false)}
        />
      )}

      {/* F053: celebration for a milestone crossed off the check-in path
          (review / event / anniversary), surfaced on focus/refetch. */}
      <MilestoneCelebrationSheet
        visible={celebrateMilestoneKey != null}
        milestoneKey={celebrateMilestoneKey}
        shareUrl={playerUrl(user?.id ?? '')}
        onClose={() => setCelebrateMilestoneKey(null)}
      />

      {user?.id && (
        <QuickMatchModal visible={quickMatchVisible} userId={user.id} onClose={() => setQuickMatchVisible(false)} />
      )}

      {/* F060: log a training session from the profile. */}
      <LogTrainingModal visible={trainingVisible} onDismiss={() => setTrainingVisible(false)} />

      {homeVenuePickerVisible ? (
        <VenuePickerModal
          visible={homeVenuePickerVisible}
          selectedVenueId={homeVenue?.id ?? (profileRaw as any)?.home_venue_id ?? null}
          onSelect={setHomeVenue}
          onClose={() => setHomeVenuePickerVisible(false)}
        />
      ) : null}

      {/* F050: streak detail (current/best + which day still counts this week). */}
      <Modal
        visible={streakDetailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStreakDetailVisible(false)}
      >
        <Pressable style={styles.streakOverlay} onPress={() => setStreakDetailVisible(false)}>
          <Pressable style={styles.streakCard} onPress={() => {}} testID="profile-streak-detail">
            <View style={styles.streakCardHeader}>
              <Lucide name="flame" size={22} color={colors.primary} />
              <Text style={styles.streakCardTitle}>{s('streakTitle')}</Text>
            </View>
            <View style={styles.streakStatRow}>
              <View style={styles.streakStat}>
                <Text style={styles.streakStatValue}>{currentStreak}</Text>
                <Text style={styles.streakStatLabel}>{s('streakCurrent')}</Text>
              </View>
              <View style={styles.streakStat}>
                <Text style={styles.streakStatValue}>{bestStreak}</Text>
                <Text style={styles.streakStatLabel}>{s('streakBest')}</Text>
              </View>
            </View>
            <Text style={styles.streakHint}>{s('streakDetailHint')}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
