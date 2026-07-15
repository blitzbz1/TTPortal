import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { showAlert } from '../lib/dialogs';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '../theme';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Lucide } from '../components/Icon';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { FeedbackHeaderButton } from '../components/FeedbackHeaderButton';
import { BadgeTrackIcon } from '../components/BadgeTrackIcon';
import { Card } from '../components/Card';
import { LocationSelector, SelectedCityPill } from '../components/LocationSelector';
import { EventCardSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { useTheme } from '../hooks/useTheme';
import { createStyles } from './EventSchedulingScreen.styles';
import { AmaturDetailSheet } from './EventSchedulingScreen/AmaturDetailSheet';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import { useSelectedLocation } from '../hooks/useSelectedLocation';
import { joinEvent, leaveEvent } from '../services/events';
import { invalidateEventsCache, type EventTabKey } from '../lib/eventsCache';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEventsQuery,
  usePastEventsInfiniteQuery,
  useAmaturEventsQuery,
  isEventsCacheFresh,
  eventsQueryKeyPrefix,
  type EventListItem,
} from '../hooks/queries/useEventsQuery';
import { WriteEventFeedbackScreen } from './WriteEventFeedbackScreen';
import { hapticMedium } from '../lib/haptics';
import { type AmaturEvent } from '../services/amatur';
import { LogHoursModal } from '../components/LogHoursModal';
import { ProductEvents, trackProductEvent } from '../lib/analytics';
import { BADGE_TRACKS } from '../features/challenges/badgeDefinitions';
import { getCityDisplayName } from '../lib/locationHelpers';
import {
  requiresOtherPlayer,
  resolveChallengeTitle,
  type DbChallenge,
  type EventChallengeSubmission,
  useCurrentSelectedChallenge,
} from '../features/challenges';

type EventTab = 'upcoming' | 'past' | 'mine' | 'amatur';

interface EventSchedulingScreenProps {
  hideTabBar?: boolean;
}

export function EventSchedulingScreen({ hideTabBar = false }: EventSchedulingScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [feedbackEventId, setFeedbackEventId] = useState<number | null>(null);
  // Feedback submitted from this screen — layered over the per-page ids
  // from the past query until its next refetch (T050).
  const [localFeedbackGiven, setLocalFeedbackGiven] = useState<Set<number>>(new Set());
  const [logHoursEvent, setLogHoursEvent] = useState<{ id: number; title: string; initialHours: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAmatur, setSelectedAmatur] = useState<AmaturEvent | null>(null);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const { user } = useSession();
  const { selectedCity } = useSelectedLocation();
  const { s, lang } = useI18n();
  const router = useRouter();
  const {
    eventId: eventIdParam,
    tab: tabParam,
    refreshEvents: refreshEventsParam,
  } = useLocalSearchParams<{ eventId?: string; tab?: string; refreshEvents?: string }>();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const { styles } = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const currentSelectedChallenge = useCurrentSelectedChallenge();
  const currentEventChallenge = currentSelectedChallenge && requiresOtherPlayer(currentSelectedChallenge)
    ? currentSelectedChallenge
    : null;
  const currentChallengeTrack = currentEventChallenge
    ? BADGE_TRACKS.find((track) => track.category === currentEventChallenge.category)
    : null;
  const handledRefreshRef = React.useRef<string | null>(null);
  const hasFocusedOnceRef = React.useRef(false);
  const selectedCityName = getCityDisplayName(selectedCity);

  const requestedTab = useMemo<EventTab | null>(() => {
    if (tabParam === 'upcoming' || tabParam === 'past' || tabParam === 'mine' || tabParam === 'amatur') {
      return tabParam;
    }
    return null;
  }, [tabParam]);

  // T050: react-query owns the list data — fetching, the persistent-cache
  // mirror and offline hydration all live in useEventsQuery.ts. The screen
  // only picks which query is active and decides when a refetch is forced.
  const queryClient = useQueryClient();
  const listTab = activeTab === 'mine' ? ('mine' as const) : ('upcoming' as const);
  const {
    data: tabEventsData,
    isLoading: tabEventsLoading,
    isError: tabEventsIsError,
    refetch: refetchTabEvents,
  } = useEventsQuery(listTab, user?.id, selectedCityName, activeTab === 'upcoming' || activeTab === 'mine');
  const {
    data: pastData,
    isLoading: pastIsLoading,
    isError: pastIsError,
    refetch: refetchPast,
    fetchNextPage: fetchNextPastPage,
    hasNextPage: pastHasMore,
    isFetchingNextPage: pastLoadingMore,
  } = usePastEventsInfiniteQuery(user?.id, selectedCityName, activeTab === 'past');
  const {
    data: amaturData,
    isLoading: amaturIsLoading,
    isError: amaturIsError,
    errorUpdatedAt: amaturErrorAt,
    refetch: refetchAmatur,
  } = useAmaturEventsQuery(activeTab === 'amatur');

  const pastEvents = useMemo(
    () => (pastData?.pages ?? []).flatMap((page) => page.events),
    [pastData],
  );
  const events: EventListItem[] = activeTab === 'past' ? pastEvents : (tabEventsData ?? []);
  const hasEventsData = activeTab === 'past' ? !!pastData : !!tabEventsData;
  const loading = (activeTab === 'past' ? pastIsLoading : tabEventsLoading) && !hasEventsData;
  const activeIsError = activeTab === 'past' ? pastIsError : tabEventsIsError;
  // No data at all → full-screen error; a failed refetch with cached events
  // on screen shows the 'offlineData' banner instead (T035).
  const eventsError = activeIsError && !hasEventsData;
  const showingCached = activeIsError && hasEventsData;
  const amaturEvents = amaturData ?? [];
  const amaturLoading = amaturIsLoading && !amaturData;

  // Feedback-given ids ride along on each past page (fetched in the same
  // round trip as the page, exactly as before T050).
  const feedbackGivenIds = useMemo(() => {
    const ids = new Set(localFeedbackGiven);
    for (const page of pastData?.pages ?? []) {
      for (const id of page.feedbackGivenIds) ids.add(id);
    }
    return ids;
  }, [pastData, localFeedbackGiven]);

  const refetchActive = useCallback(async (force = false) => {
    if (activeTab === 'amatur') {
      await refetchAmatur();
      return;
    }
    const tab = activeTab as EventTabKey;
    // force=false (T043): quick Map↔Events toggles take the disk-cache TTL
    // fast-path. Disk invalidation by mutation sites (event edits, logged
    // hours, feedback) still forces a refetch through here even when the
    // in-memory query is within staleTime.
    if (!force && isEventsCacheFresh(user?.id, tab, selectedCityName)) return;
    if (tab === 'past') await refetchPast();
    else await refetchTabEvents();
  }, [activeTab, refetchAmatur, refetchPast, refetchTabEvents, selectedCityName, user?.id]);

  const loadMorePastEvents = useCallback(() => {
    if (activeTab !== 'past' || loading) return;
    if (pastLoadingMore || !pastHasMore) return;
    fetchNextPastPage();
  }, [activeTab, loading, pastLoadingMore, pastHasMore, fetchNextPastPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchActive(true);
    setRefreshing(false);
  }, [refetchActive]);

  useEffect(() => {
    if (!requestedTab || !refreshEventsParam) return;
    if (handledRefreshRef.current === refreshEventsParam) return;
    if (requestedTab !== activeTab) setActiveTab(requestedTab);
  }, [requestedTab, refreshEventsParam, activeTab]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      refetchActive(false);
    }, [refetchActive]),
  );

  useEffect(() => {
    if (!refreshEventsParam || handledRefreshRef.current === refreshEventsParam) return;
    if (requestedTab && requestedTab !== activeTab) return;
    handledRefreshRef.current = refreshEventsParam;
    refetchActive(true);
  }, [refreshEventsParam, requestedTab, activeTab, refetchActive]);

  // AmaTur fetch failed with nothing to show — the service falls back to
  // its own stale cache when it can, so this is the truly-offline case.
  useEffect(() => {
    if (amaturIsError) showAlert(s('error'), s('ampiLoadError'));
  }, [amaturIsError, amaturErrorAt, s]);

  const openDetail = useCallback((event: EventListItem) => {
    router.push({ pathname: '/event/[eventId]', params: { eventId: String(event.id) } });
  }, [router]);

  // Legacy deep-link compatibility: notifications still navigate to
  // /(tabs)/events?eventId=X. Forward the user straight to the detail
  // route so they don't land on the list.
  const handledEventIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!eventIdParam || handledEventIdRef.current === eventIdParam) return;
    handledEventIdRef.current = eventIdParam;
    router.replace({ pathname: '/event/[eventId]', params: { eventId: String(eventIdParam) } });
  }, [eventIdParam, router]);

  const challengeTitle = useCallback((challenge: {
    challenge_legacy_code?: string | null;
    challenge_title_key?: string | null;
    challenge_title?: string | null;
    legacy_code?: string | null;
    title_key?: string | null;
    title?: string | null;
  }) => resolveChallengeTitle(s, challenge as DbChallenge | EventChallengeSubmission), [s]);

  const handleJoin = useCallback(async (event: EventListItem) => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    if (event.status === 'closed') {
      showAlert(s('closed'), s('eventClosedJoinError'));
      return;
    }
    const isJoined =
      (event.my_participation?.length ?? 0) > 0 ||
      event.event_participants?.some((p: any) => p.user_id === user.id);
    if (isJoined) {
      const { error } = await leaveEvent(event.id, user.id);
      if (error) {
        showAlert(s('error'), s('leaveError'));
        return;
      }
    } else {
      const { error } = await joinEvent(event.id, user.id);
      if (error) {
        showAlert(s('error'), s('joinError'));
        return;
      }
    }
    trackProductEvent(ProductEvents.eventJoined, {
      eventId: event.id,
      action: isJoined ? 'leave' : 'join',
    });
    // T050: join/leave changes joined-state and counts everywhere — drop the
    // disk mirror and re-pull through react-query (the active query refetches
    // immediately, inactive tabs on their next mount).
    invalidateEventsCache(user.id, ['upcoming', 'mine']);
    queryClient.invalidateQueries({ queryKey: eventsQueryKeyPrefix });
  }, [user, router, s, queryClient]);

  const locale = getDateLocale(lang);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isEffectivelyOver = useCallback((event: any) => {
    if (event.ends_at) return new Date(event.ends_at) < new Date();
    // No end date: assume event closes at end of the start day
    const endOfDay = new Date(event.starts_at);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay < new Date();
  }, []);

  // True when the event has started but hasn't ended yet — used by the
  // upcoming-tab cards to show a "live" timer icon.
  const isInProgress = useCallback((event: any) => {
    if (event.status === 'closed' || event.status === 'cancelled' || event.status === 'completed') return false;
    const now = Date.now();
    const start = new Date(event.starts_at).getTime();
    if (start > now) return false;
    return !isEffectivelyOver(event);
  }, [isEffectivelyOver]);

  const getBadgeInfo = useCallback((event: any) => {
    if (event.status === 'completed' || (event.status !== 'cancelled' && isEffectivelyOver(event))) {
      return { text: s('completed'), bg: colors.borderLight, color: colors.textMuted, icon: undefined as string | undefined };
    }
    if (event.status === 'cancelled') {
      return { text: s('cancelled'), bg: colors.cancelledBadgeBg, color: colors.red, icon: undefined as string | undefined };
    }
    if (event.status === 'closed') {
      return { text: s('closed'), bg: colors.redPale, color: colors.red, icon: 'lock' as string | undefined };
    }
    if (isInProgress(event)) {
      return { text: s('inProgress'), bg: colors.primaryPale, color: colors.primaryLight, icon: 'timer' as string | undefined };
    }
    if (event.status === 'confirmed') {
      return { text: s('confirmed'), bg: colors.primaryPale, color: colors.primaryMid, icon: undefined as string | undefined };
    }
    if (event.event_type === 'tournament') {
      return { text: s('tournament'), bg: colors.bluePale, color: colors.blue, icon: undefined as string | undefined };
    }
    return { text: s('open'), bg: colors.primaryPale, color: colors.greenDeep, icon: undefined as string | undefined };
  }, [colors, s, isEffectivelyOver, isInProgress]);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const AVATAR_COLORS = [
    '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#c026d3',
    '#db2777', '#dc2626', '#ea580c', '#d97706', '#4f46e5',
  ];
  const getAvatarColor = (id: string) =>
    AVATAR_COLORS[Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % AVATAR_COLORS.length];

  const isPast = (event: any) =>
    event.status === 'completed' || event.status === 'cancelled' || isEffectivelyOver(event);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{s('events')}</Text>
        </View>
        <View style={styles.headerCenter} pointerEvents="box-none">
          <SelectedCityPill city={selectedCity} onPress={() => setCityModalVisible(true)} compact />
        </View>
        <View style={styles.headerActions}>
          {user ? (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/clubs')}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              accessibilityRole="button"
              accessibilityLabel={s('clubsTitle')}
              testID="events-clubs-button"
            >
              <Lucide name="users-round" size={18} color={headerFg} />
            </TouchableOpacity>
          ) : null}
          <FeedbackHeaderButton color={headerFg} />
          <NotificationBellButton color={headerFg} />
        </View>
      </View>

      {(() => {
        const refreshControl = (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        );

        const listHeader = (
          <>
      <View style={styles.tabs}>
          {[
            { key: 'upcoming' as EventTab, label: `${s('upcoming')} (${activeTab === 'upcoming' ? events.length : ''})`.replace('()', '').trim() },
            { key: 'past' as EventTab, label: s('past') },
            ...(user ? [{ key: 'mine' as EventTab, label: s('mine') }] : []),
            { key: 'amatur' as EventTab, label: s('ampiTag') },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'upcoming' && currentEventChallenge && currentChallengeTrack && (
          <View
            style={[
              styles.readyChallengeBanner,
              {
                borderColor: currentChallengeTrack.color,
              },
            ]}
          >
            <View style={styles.readyChallengeIcon}>
              <BadgeTrackIcon
                badge={currentChallengeTrack}
                size={32}
                variant="picker"
                fallbackColor={currentChallengeTrack.color}
              />
            </View>
            <View style={styles.readyChallengeCopy}>
              <Text style={styles.readyChallengeTitle}>
                {s('eventReadyChallengeTitle')}
              </Text>
              <Text style={styles.readyChallengeText} numberOfLines={2}>
                {challengeTitle(currentEventChallenge)}
              </Text>
            </View>
          </View>
        )}

        {showingCached && activeTab !== 'amatur' && (
          <View
            testID="events-cached-banner"
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, paddingVertical: 6,
            }}
          >
            <Lucide name="wifi-off" size={12} color={colors.textFaint} />
            <Text style={{ fontSize: 12, color: colors.textFaint }}>{s('offlineData')}</Text>
          </View>
        )}
          </>
        );

        const isAmatur = activeTab === 'amatur';
        const listData: any[] = isAmatur
          ? (amaturLoading ? [] : amaturEvents)
          : (loading || eventsError ? [] : events);

        const listEmpty = isAmatur ? (
          amaturLoading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <SkeletonList count={3}><EventCardSkeleton /></SkeletonList>
            </View>
          ) : (
            <EmptyState
              icon="trophy"
              title={s('ampiEmptyTitle')}
              description={s('ampiEmptyDesc')}
              iconColor={colors.blue}
              iconBg={colors.bluePale}
            />
          )
        ) : loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            <SkeletonList count={3}><EventCardSkeleton /></SkeletonList>
          </View>
        ) : eventsError ? (
          <ErrorState
            title={s('eventsLoadError')}
            description={s('eventsLoadErrorDesc')}
            ctaLabel={s('retry')}
            onRetry={() => refetchActive()}
          />
        ) : (
          <EmptyState
            icon="calendar"
            title={s('emptyEventsCityTitle', selectedCityName)}
            description={s('emptyEventsCityDesc', selectedCityName)}
            ctaLabel={user ? s('emptyEventsCta') : undefined}
            onCtaPress={user ? () => router.push('/(protected)/create-event') : undefined}
            iconColor={colors.accentBright}
            iconBg={colors.amberPale}
          />
        );

        const renderEventRow = (event: EventListItem) => {
                const badge = getBadgeInfo(event);
                // Joined-state from the filtered alias (T043) — the visible
                // embed is capped at 6 and may not include the caller.
                const isJoined =
                  (event.my_participation?.length ?? 0) > 0 ||
                  event.event_participants?.some((p: any) => p.user_id === user?.id);
                const participants = event.event_participants ?? [];
                const participantsTotal =
                  event.participants_count?.[0]?.count ?? participants.length;
                const venueName = event.venues?.name ?? s('unknownVenue');

                return (
                  <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
                  <Card shadow="sm" borderRadius={14}>
                    <TouchableOpacity style={styles.eventCard} activeOpacity={0.7} onPress={() => openDetail(event)}>
                      {/* Top */}
                      <View style={styles.eventTop}>
                        <View style={styles.eventDateWrap}>
                          <Lucide name="calendar" size={14} color={colors.accentBright} />
                          <Text style={styles.eventDate}>
                            {formatDate(event.starts_at)} {'\u00B7'} {formatTime(event.starts_at)}
                          </Text>
                          {event.recurrence_rule && (
                            <Lucide name="repeat" size={13} color={colors.purple} />
                          )}
                        </View>
                        <View style={[styles.eventBadge, { backgroundColor: badge.bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                          {badge.icon && (
                            <Lucide name={badge.icon} size={11} color={badge.color} />
                          )}
                          <Text style={[styles.eventBadgeText, { color: badge.color }]}>
                            {badge.text}
                          </Text>
                        </View>
                      </View>

                      {/* Location */}
                      <View style={styles.eventMid}>
                        <Lucide name="map-pin" size={14} color={colors.textFaint} />
                        <Text style={styles.eventLocation}>
                          {event.title ? `${venueName} — ${event.title}` : venueName}
                        </Text>
                      </View>

                      {/* Bottom */}
                      <View style={styles.eventBot}>
                        <View style={styles.avatarStack}>
                          {participants.slice(0, 5).map((p: any, i: number) => (
                            <View
                              key={p.user_id}
                              style={[
                                styles.stackAvatar,
                                { marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i, backgroundColor: getAvatarColor(p.user_id) },
                              ]}
                            >
                              <Text style={styles.stackInitials}>
                                {getInitials(p.profiles?.full_name)}
                              </Text>
                            </View>
                          ))}
                          <Text style={styles.attendeesText}>
                            {participantsTotal}/{event.max_participants ?? '\u221E'} {s('spots')}
                          </Text>
                        </View>
                        {activeTab !== 'past' && !isPast(event) && event.status !== 'closed' && event.organizer_id !== user?.id && (
                          <TouchableOpacity
                            style={[styles.joinBtn, isJoined ? styles.joinedBtn : styles.notJoinedBtn]}
                            onPress={(e) => { e.stopPropagation(); hapticMedium(); handleJoin(event); }}
                          >
                            <Lucide
                              name={isJoined ? 'check' : 'user-plus'}
                              size={14}
                              color={isJoined ? colors.textOnPrimary : colors.primary}
                            />
                            <Text style={[styles.joinText, isJoined ? styles.joinedText : styles.notJoinedText]}>
                              {isJoined ? s('joined') : s('join')}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {(() => {
                          if (!isPast(event) || event.status === 'cancelled') return null;
                          const myRow =
                            event.my_participation?.[0] ??
                            (event.event_participants ?? []).find((p: any) => p.user_id === user?.id);
                          const canInteract = !!myRow || event.organizer_id === user?.id;
                          if (!canInteract) return null;
                          const loggedHours = Number(myRow?.hours_played ?? 0);
                          const hasLoggedHours = loggedHours > 0;
                          const hasGivenFeedback = feedbackGivenIds.has(event.id);
                          return (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', flexGrow: 1, flexShrink: 1, justifyContent: 'flex-end', gap: 6 }}>
                              {!hasLoggedHours && (
                                <TouchableOpacity
                                  style={[styles.joinBtn, styles.notJoinedBtn]}
                                  onPress={(e) => { e?.stopPropagation?.(); setLogHoursEvent({ id: event.id, title: event.title ?? '', initialHours: loggedHours }); }}
                                >
                                  <Lucide name="clock" size={14} color={colors.primary} />
                                  <Text style={[styles.joinText, styles.notJoinedText]}>{s('logHours')}</Text>
                                </TouchableOpacity>
                              )}
                              {event.organizer_id !== user?.id && !hasGivenFeedback && (
                                <TouchableOpacity
                                  style={[styles.joinBtn, styles.notJoinedBtn]}
                                  onPress={(e) => { e?.stopPropagation?.(); setFeedbackEventId(event.id); }}
                                >
                                  <Lucide name="message-square" size={14} color={colors.primary} />
                                  <Text style={[styles.joinText, styles.notJoinedText]}>{s('giveFeedback')}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    </TouchableOpacity>
                  </Card>
                  </View>
                );
        };

        const renderAmaturRow = (ev: AmaturEvent) => (
                <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
                        <Card shadow="sm" borderRadius={14}>
                          <TouchableOpacity
                            style={styles.eventCard}
                            activeOpacity={0.7}
                            onPress={() => setSelectedAmatur(ev)}
                          >
                            {/* Date row */}
                            <View style={styles.eventTop}>
                              <View style={styles.eventDateWrap}>
                                <Lucide name="calendar" size={14} color={colors.accentBright} />
                                <Text style={styles.eventDate}>
                                  {ev.startDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
                                </Text>
                              </View>
                              {ev.tables != null && (
                                <View style={[styles.eventBadge, { backgroundColor: colors.bluePale }]}>
                                  <Text style={[styles.eventBadgeText, { color: colors.blue }]}>
                                    {ev.tables} {s('tables')}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* City */}
                            <View style={styles.eventMid}>
                              <Lucide name="map-pin" size={14} color={colors.textFaint} />
                              <Text style={styles.eventLocation}>{ev.city}</Text>
                            </View>

                            {/* Event name */}
                            {ev.name && (
                              <View style={styles.eventMid}>
                                <Lucide name="trophy" size={14} color={colors.amber} />
                                <Text style={styles.eventLocation}>{ev.name}</Text>
                              </View>
                            )}

                            {/* Per-category spots */}
                            {ev.categorySpots.length > 0 && (
                              <View style={styles.amaturSpotsRow}>
                                {ev.categorySpots.map((cs) => (
                                  <View key={cs.category} style={styles.amaturSpotChip}>
                                    <Text style={styles.amaturSpotLabel}>{cs.category[0]}</Text>
                                    <Text style={styles.amaturSpotValue}>{cs.spots}</Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            {/* Day distribution + forum */}
                            <View style={styles.eventBot}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                {ev.categories.length > 0 && (
                                  <View style={styles.amaturCatRow}>
                                    {ev.categories.map((cat, ci) => (
                                      <Text key={ci} style={styles.amaturCatText}>{cat}</Text>
                                    ))}
                                  </View>
                                )}
                              </View>
                              {ev.forumUrl && (
                                <TouchableOpacity
                                  style={[styles.joinBtn, styles.notJoinedBtn]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    Linking.openURL(ev.forumUrl!);
                                  }}
                                >
                                  <Lucide name="external-link" size={14} color={colors.primary} />
                                  <Text style={[styles.joinText, styles.notJoinedText]}>Forum</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </TouchableOpacity>
                        </Card>
                </View>
        );

        // One always-mounted FlashList (T042): the tab bar lives in its
        // header, so it never remounts across loading/error/empty/data
        // transitions; ListEmptyComponent carries the state screens. The
        // manual onScroll pagination is replaced by onEndReached. No
        // entering animations on rows — recycling breaks them (T046).
        return (
          <FlashList
            data={listData}
            keyExtractor={(item: any) => String(item.id)}
            testID="events-list"
            keyboardDismissMode="on-drag"
            refreshControl={refreshControl}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={{ paddingBottom: Spacing.md }}
            onEndReached={!isAmatur && activeTab === 'past' ? loadMorePastEvents : undefined}
            onEndReachedThreshold={0.6}
            drawDistance={400}
            ListFooterComponent={
              isAmatur && listData.length > 0 ? (
                <Text style={styles.amaturAttribution}>{s('ampiPoweredBy')}</Text>
              ) : !isAmatur && activeTab === 'past' && pastLoadingMore ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primaryMid} />
                </View>
              ) : null
            }
            renderItem={({ item }) =>
              isAmatur ? renderAmaturRow(item as AmaturEvent) : renderEventRow(item as EventListItem)
            }
          />
        );
      })()}

      {/* FAB — Create Event */}
      {user && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(protected)/create-event')}
          activeOpacity={0.8}
          testID="create-event-fab"
        >
          <Lucide name="plus" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
      )}

      <WriteEventFeedbackScreen
        visible={feedbackEventId !== null}
        eventId={feedbackEventId}
        onDismiss={() => {
          if (feedbackEventId) setLocalFeedbackGiven((prev) => new Set(prev).add(feedbackEventId));
          setFeedbackEventId(null);
          // A submit invalidated the disk cache — the stale path refetches.
          refetchActive(false);
        }}
      />

      <LogHoursModal
        visible={logHoursEvent !== null}
        eventId={logHoursEvent?.id ?? null}
        eventTitle={logHoursEvent?.title}
        initialHours={logHoursEvent?.initialHours}
        onDismiss={() => {
          setLogHoursEvent(null);
          // Logged hours invalidate the past disk cache — stale path refetches.
          refetchActive(false);
        }}
      />

      <AmaturDetailSheet
        event={selectedAmatur}
        bottomInset={insets.bottom}
        onClose={() => setSelectedAmatur(null)}
      />
      <LocationSelector
        visible={cityModalVisible}
        mode="switcher"
        onClose={() => setCityModalVisible(false)}
      />
    </View>
  );
}
