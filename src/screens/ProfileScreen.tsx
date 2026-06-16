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
import { SkillChip } from '../components/SkillChip';
import { PlayProfileEditorModal } from '../components/PlayProfileEditorModal';
import { playGoalKey } from '../lib/playerAttributes';
import { usePlayerMatchesQuery, summarizeMatches, useRivalsQuery } from '../features/matches';
import { sendMatchInvite } from '../features/findPlayers';
import { usePlayerRatingQuery } from '../features/ratings';
import { RatingChip } from '../components/RatingChip';
import { RatingSparkline } from '../components/RatingSparkline';
import { RatingCelebrationSheet } from '../components/RatingCelebrationSheet';
import { MilestoneCelebrationSheet } from '../components/MilestoneCelebrationSheet';
import {
  useMilestonesQuery,
  MILESTONE_DEFS,
  MILESTONE_DEF_BY_KEY,
  nextMilestoneGhost,
  yearsSince,
} from '../features/milestones';
import { QuickMatchModal } from '../components/QuickMatchModal';
import { getLastSeenRating, setLastSeenRating, shouldCelebrateRating } from '../lib/ratingsCache';
import { useHomeVenueQuery, useHomeVenueSuggestionQuery, homeVenueQueryKey } from '../features/venueIntel';
import { isWrappedWindowOpen, wrappedYearFor } from '../features/wrapped';
import { updateProfile } from '../services/profiles';
import { useQueryClient } from '@tanstack/react-query';

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
  const { data: matches = [] } = usePlayerMatchesQuery(user?.id);
  const confirmedMatches = useMemo(
    () => matches.filter((m) => m.status === 'confirmed' && m.winner_id),
    [matches],
  );
  const matchRecord = useMemo(() => summarizeMatches(matches, user?.id ?? ''), [matches, user?.id]);

  // ── F031: rivals (most-played opponents) + Challenge.
  const { data: rivals = [] } = useRivalsQuery(user?.id);
  const [challengedRivals, setChallengedRivals] = useState<Set<string>>(new Set());
  const challengeRival = useCallback(async (rivalId: string) => {
    setChallengedRivals((prev) => new Set(prev).add(rivalId));
    const { error } = await sendMatchInvite(rivalId);
    if (error) {
      setChallengedRivals((prev) => { const n = new Set(prev); n.delete(rivalId); return n; });
      showAlert(s('error'), s('genericError'));
    }
  }, [s]);

  // ── F030: rating + celebration on rating-up.
  const { data: rating } = usePlayerRatingQuery(user?.id);
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
  const { data: profileStats } = useProfileStatsQuery(user?.id);
  const currentStreak = profileStats?.current_streak ?? 0;
  const bestStreak = profileStats?.best_streak ?? 0;
  const [streakDetailVisible, setStreakDetailVisible] = useState(false);

  // F054: TT Wrapped — the year-in-review banner only shows inside the
  // Dec 15 – Jan 15 window; tapping it opens the swipeable story.
  const wrappedOpen = isWrappedWindowOpen();
  const wrappedYear = wrappedYearFor();

  // F053: lifetime milestones — earned set + the next locked "ghost" + a
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
      // Combined check-in + event hours — matches what the hours milestones are
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

  // F014: home venue ("plays at X") + auto-suggestion when none is set yet.
  const queryClient = useQueryClient();
  const { data: homeVenue } = useHomeVenueQuery(user?.id);
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetchProfile} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={styles.profileSummaryCard}>
          <View style={styles.identityHeaderRow}>
            <View style={styles.identityHeaderIcon}>
              <Text style={styles.identityHeaderIconText}>{initials}</Text>
            </View>
            <View style={styles.identityHeaderCopy}>
              <Text style={styles.summaryName}>{fullName || s('user')}</Text>
              <View style={styles.identityMetaRow}>
                {usernameDisplay ? <Text style={styles.summaryHandle} numberOfLines={1}>{usernameDisplay}</Text> : null}
                <TouchableOpacity
                  testID="profile-challenges-pill"
                  style={styles.challengeChip}
                  onPress={() => router.push({ pathname: '/(tabs)/challenges', params: { tab: 'badges' } })}
                  activeOpacity={0.78}
                >
                  <Lucide name="medal" size={12} color={colors.primary} />
                  <Text style={styles.challengeChipText}>
                    {completedChallengeCount} {s('profileChallengesCompleted')}
                  </Text>
                </TouchableOpacity>
                {/* F030: rating chip */}
                <RatingChip rating={rating?.rating} provisional={rating?.provisional} />
                {/* F050: weekly play streak flame chip (tap for current/best). */}
                {currentStreak > 0 ? (
                  <TouchableOpacity
                    testID="profile-streak-chip"
                    style={styles.streakChip}
                    onPress={() => setStreakDetailVisible(true)}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                  >
                    <Lucide name="flame" size={12} color={colors.accent} />
                    <Text style={styles.streakChipText}>{s('streakWeeks', currentStreak)}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

        </View>

        {/* TT Wrapped (F054): year-in-review banner, only inside Dec 15 – Jan 15. */}
        {wrappedOpen ? (
          <TouchableOpacity
            style={styles.wrappedBanner}
            onPress={() => router.push({ pathname: '/wrapped', params: { year: String(wrappedYear) } })}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="profile-wrapped-banner"
          >
            <View style={styles.wrappedBannerIcon}>
              <Lucide name="gift" size={20} color={colors.accent} />
            </View>
            <View style={styles.wrappedBannerCopy}>
              <Text style={styles.wrappedBannerTitle}>{s('wrappedBannerTitle', String(wrappedYear))}</Text>
              <Text style={styles.wrappedBannerSubtitle}>{s('wrappedBannerCta')}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Milestones (F053): earned lifetime milestones + the next locked ghost. */}
        {(earnedKeys.size > 0 || milestoneGhost) && (
          <View style={styles.section} testID="profile-milestones-strip">
            <Text style={[styles.navLabel, { fontWeight: '700', marginBottom: 8 }]}>
              {s('milestonesTitle')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MILESTONE_DEFS.filter((d) => earnedKeys.has(d.key)).map((d) => (
                <View
                  key={d.key}
                  style={styles.milestoneChip}
                  testID={`milestone-earned-${d.key}`}
                >
                  <Lucide name={d.icon} size={13} color={colors.accent} />
                  <Text style={styles.milestoneChipText}>{s(d.titleKey)}</Text>
                </View>
              ))}
              {milestoneGhost ? (
                <View
                  style={styles.milestoneGhostChip}
                  testID="milestone-ghost"
                >
                  <Lucide
                    name={MILESTONE_DEF_BY_KEY[milestoneGhost.def.key]?.icon ?? 'lock'}
                    size={13}
                    color={colors.textFaint}
                  />
                  <Text style={styles.milestoneGhostText}>
                    {s('milestoneGhostProgress', String(milestoneGhost.current), String(milestoneGhost.threshold))}
                    {' · '}
                    {s(milestoneGhost.def.titleKey)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Play profile (F001): self-declared skill + goals */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={[styles.navLabel, { fontWeight: '700' }]}>{s('playProfileTitle')}</Text>
            <TouchableOpacity onPress={() => setEditorVisible(true)} testID="edit-play-profile" hitSlop={8}>
              <Lucide name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {profile?.skill_level || (profile?.play_goals?.length ?? 0) > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <SkillChip skillLevel={profile?.skill_level ?? null} />
              {(profile?.play_goals ?? []).map((g) => (
                <View key={g} style={{ borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: colors.bgMuted }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>{s(playGoalKey(g))}</Text>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditorVisible(true)}>
              <Text style={{ color: colors.textFaint, fontSize: 14 }}>{s('playProfileEmpty')}</Text>
            </TouchableOpacity>
          )}
          {/* Home venue: "plays at X", or a suggestion when none is set (F014). */}
          {homeVenue ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/venue/[id]', params: { id: String(homeVenue.id) } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
              testID="profile-home-venue"
            >
              <Lucide name="home" size={14} color={colors.primaryMid} />
              <Text style={{ fontSize: 13, color: colors.textMuted }}>{s('playsAt', homeVenue.name)}</Text>
            </TouchableOpacity>
          ) : homeSuggestion ? (
            <TouchableOpacity
              onPress={acceptHomeSuggestion}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
              testID="profile-home-venue-suggestion"
            >
              <Lucide name="home" size={14} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.primaryMid, fontWeight: '600' }}>
                {s('homeVenueSuggest', homeSuggestion.name)}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Rating (F030): current/peak + 90-day sparkline + last-5 deltas */}
        {rating != null && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.navLabel, { fontWeight: '700' }]}>{s('ratingTitle')}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>
                {s('ratingPeak')} {Math.round(rating.peak)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <Text style={{ fontSize: 32, fontWeight: '800', color: colors.accent }}>{Math.round(rating.rating)}</Text>
              {rating.provisional ? (
                <Text style={{ fontSize: 12, color: colors.textFaint, marginBottom: 6 }}>{s('ratingProvisional')}</Text>
              ) : null}
              <View style={{ marginLeft: 'auto' }}>
                <RatingSparkline points={rating.spark} width={150} height={40} />
              </View>
            </View>
            {rating.last5.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {rating.last5.map((d, i) => (
                  <View
                    key={i}
                    style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: d >= 0 ? colors.primaryPale : colors.redPale }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: d >= 0 ? colors.primary : colors.red }}>
                      {d >= 0 ? `+${d}` : `${d}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Matches (F002): W/L record + last 5 results */}
        {confirmedMatches.length > 0 && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[styles.navLabel, { fontWeight: '700' }]}>{s('matchesTitle')}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>
                {matchRecord.wins}{s('winShort')} · {matchRecord.losses}{s('lossShort')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {confirmedMatches.slice(0, 5).map((m) => {
                const win = m.winner_id === user?.id;
                return (
                  <View
                    key={m.id}
                    style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: win ? colors.primaryPale : colors.redPale }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: win ? colors.primary : colors.red }}>
                      {win ? s('winShort') : s('lossShort')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Rivals (F031): most-played opponents + Challenge */}
        {rivals.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.navLabel, { fontWeight: '700', marginBottom: 4 }]}>{s('rivalsTitle')}</Text>
            {rivals.map((r) => {
              const challenged = challengedRivals.has(r.user_id);
              return (
                <View key={r.user_id} style={styles.navRow}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                    onPress={() => router.push({ pathname: '/(protected)/player/[userId]', params: { userId: r.user_id } })}
                  >
                    <View style={[styles.navIcon, { backgroundColor: colors.purplePale }]}>
                      <Lucide name="swords" size={18} color={colors.purple} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.navLabel} numberOfLines={1}>{r.full_name ?? s('user')}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {r.my_wins}{s('winShort')} · {r.their_wins}{s('lossShort')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: challenged ? colors.border : colors.primary, backgroundColor: challenged ? colors.bgAlt : colors.primaryPale }}
                    disabled={challenged}
                    onPress={() => challengeRival(r.user_id)}
                    accessibilityRole="button"
                    testID={`rival-challenge-${r.user_id}`}
                  >
                    <Lucide name={challenged ? 'check' : 'swords'} size={13} color={challenged ? colors.textMuted : colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: challenged ? colors.textMuted : colors.primary }}>
                      {challenged ? s('findPlayersChallengeSent') : s('findPlayersChallenge')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Navigation Links */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/friends')}>
            <View style={[styles.navIcon, { backgroundColor: colors.primaryPale }]}>
              <Lucide name="users" size={18} color={colors.primaryMid} />
            </View>
            <Text style={styles.navLabel}>{s('friends')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          {user?.id && (
            <TouchableOpacity style={styles.navRow} onPress={() => setQuickMatchVisible(true)} testID="profile-quick-match">
              <View style={[styles.navIcon, { backgroundColor: colors.amberPale }]}>
                <Lucide name="qr-code" size={18} color={colors.accent} />
              </View>
              <Text style={styles.navLabel}>{s('quickMatchTitle')}</Text>
              <Lucide name="chevron-right" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/play-history')}>
            <View style={[styles.navIcon, { backgroundColor: colors.purplePale }]}>
              <Lucide name="trophy" size={18} color={colors.purple} />
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
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/favorites')}>
            <View style={[styles.navIcon, { backgroundColor: colors.redPale }]}>
              <Lucide name="heart" size={18} color={colors.red} />
            </View>
            <Text style={styles.navLabel}>{s('favorites')}</Text>
            <Lucide name="chevron-right" size={16} color={colors.textFaint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(protected)/leaderboard')}>
            <View style={[styles.navIcon, { backgroundColor: colors.amberPale }]}>
              <Lucide name="bar-chart-3" size={18} color={colors.accent} />
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
          onClose={() => setCelebrate(false)}
        />
      )}

      {/* F053: celebration for a milestone crossed off the check-in path
          (review / event / anniversary), surfaced on focus/refetch. */}
      <MilestoneCelebrationSheet
        visible={celebrateMilestoneKey != null}
        milestoneKey={celebrateMilestoneKey}
        onClose={() => setCelebrateMilestoneKey(null)}
      />

      {user?.id && (
        <QuickMatchModal visible={quickMatchVisible} userId={user.id} onClose={() => setQuickMatchVisible(false)} />
      )}

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
              <Lucide name="flame" size={22} color={colors.accent} />
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
