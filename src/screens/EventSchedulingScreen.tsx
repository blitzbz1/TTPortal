import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl, Linking } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Lucide } from '../components/Icon';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { FeedbackHeaderButton } from '../components/FeedbackHeaderButton';
import { Card } from '../components/Card';
import { EventCardSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { useTheme } from '../hooks/useTheme';
import { createStyles } from './EventSchedulingScreen.styles';
import { AmaturDetailSheet } from './EventSchedulingScreen/AmaturDetailSheet';
import { EventDetailContent } from './EventSchedulingScreen/EventDetailContent';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getEvents, getEventById, getEventParticipants, joinEvent, leaveEvent, sendEventInvites } from '../services/events';
import { getEventFeedback, getUserEventFeedbackForEvents } from '../services/eventFeedback';
import {
  loadCachedEvents,
  saveCachedEvents,
  loadCachedFeedbackGiven,
  saveCachedFeedbackGiven,
  type EventTabKey,
} from '../lib/eventsCache';
import { getFriendIds } from '../services/friends';
import { FriendPickerModal } from '../components/FriendPickerModal';
import { WriteEventFeedbackScreen } from './WriteEventFeedbackScreen';
import { hapticMedium } from '../lib/haptics';
import { getAmaturEvents, type AmaturEvent } from '../services/amatur';
import { EventDetailSheet } from '../components/EventDetailSheet';
import { LogHoursModal } from '../components/LogHoursModal';
import { BADGE_TRACKS } from '../lib/badgeChallenges';
import { ProductEvents, trackProductEvent } from '../lib/analytics';
import {
  requiresOtherPlayer,
  resolveChallengeTitle,
  setCurrentSelectedChallenge,
  type ChallengeCategory,
  type DbChallenge,
  type EventChallengeSubmission,
  useCurrentSelectedChallenge,
  useChallengeChoices,
  useEventChallenges,
} from '../features/challenges';

type EventTab = 'upcoming' | 'past' | 'mine' | 'amatur';

type EventListItem = {
  id: number;
  title?: string | null;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  event_type?: string | null;
  organizer_id?: string | null;
  max_participants?: number | null;
  recurrence_rule?: string | null;
  table_number?: number | null;
  venues?: {
    name?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  event_participants?: {
    user_id: string;
    hours_played?: number | null;
    profiles?: { full_name?: string | null } | null;
  }[];
};

interface EventSchedulingScreenProps {
  hideTabBar?: boolean;
}

export function EventSchedulingScreen({ hideTabBar = false }: EventSchedulingScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [detailParticipants, setDetailParticipants] = useState<any[]>([]);
  const [detailFeedback, setDetailFeedback] = useState<any[]>([]);
  const [eventChallengeTrackId, setEventChallengeTrackId] = useState(BADGE_TRACKS[0].id);
  const [showAddChallenge, setShowAddChallenge] = useState(false);
  const [challengeActionId, setChallengeActionId] = useState<string | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [detailLoading, setDetailLoading] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [feedbackEventId, setFeedbackEventId] = useState<number | null>(null);
  const [feedbackGivenIds, setFeedbackGivenIds] = useState<Set<number>>(new Set());
  const [logHoursEvent, setLogHoursEvent] = useState<{ id: number; title: string; initialHours: number } | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [amaturEvents, setAmaturEvents] = useState<AmaturEvent[]>([]);
  const [amaturLoading, setAmaturLoading] = useState(false);
  const [selectedAmatur, setSelectedAmatur] = useState<AmaturEvent | null>(null);
  const { user } = useSession();
  const { s, lang } = useI18n();
  const router = useRouter();
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId?: string }>();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const { styles, ms } = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const currentSelectedChallenge = useCurrentSelectedChallenge();
  const eventChallengeTrack = BADGE_TRACKS.find((badge) => badge.id === eventChallengeTrackId) ?? BADGE_TRACKS[0];
  const currentEventChallenge = currentSelectedChallenge && requiresOtherPlayer(currentSelectedChallenge)
    ? currentSelectedChallenge
    : null;
  const {
    choices: eventChallengeChoices,
  } = useChallengeChoices(eventChallengeTrack.category as ChallengeCategory, {
    enabled: showAddChallenge && !!selectedEvent && !currentEventChallenge,
    onlyOtherPlayer: true,
  });
  const {
    addChallenge: addEventChallenge,
    awardChallenge: awardEventChallenge,
    challenges: detailChallenges,
  } = useEventChallenges(selectedEvent?.id, user?.id);

  const fetchEvents = useCallback(async (force = false) => {
    if (activeTab === 'amatur') return;
    const tab = activeTab as EventTabKey;
    const userId = user?.id;

    // Cache-first for "mine" and "past": these tabs change rarely and benefit
    // from instant render. We only show the spinner if there's no cached data
    // to display. "upcoming" still hits the network on entry but takes the
    // cache fast-path if it's fresh (60s TTL) to handle quick tab toggles.
    if (!force && userId && (tab === 'mine' || tab === 'past' || tab === 'upcoming')) {
      const cached = loadCachedEvents<EventListItem>(userId, tab);
      if (cached) {
        setEvents(cached.data);
        setEventsError(false);
        if (tab === 'past') {
          const fb = loadCachedFeedbackGiven(userId);
          if (fb) setFeedbackGivenIds(new Set(fb));
        }
        if (cached.fresh) {
          setLoading(false);
          return;
        }
        // Stale cache — show data, fetch in the background without flashing
        // a spinner.
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }
    setEventsError(false);

    try {
      const { data, error } = await getEvents(
        tab,
        (tab === 'mine' || tab === 'past') ? userId : undefined,
      );
      if (error) {
        setEventsError(true);
      } else {
        const list = (data ?? []) as unknown as EventListItem[];
        setEvents(list);
        if (userId) saveCachedEvents(userId, tab, list);
        // Check which past events already have user feedback (single round trip).
        if (tab === 'past' && userId && list.length) {
          const eventIds = list.map((ev) => ev.id);
          const { data: feedbackEventIds } = await getUserEventFeedbackForEvents(userId, eventIds);
          const ids = feedbackEventIds ?? [];
          setFeedbackGivenIds(new Set(ids));
          saveCachedFeedbackGiven(userId, ids);
        }
      }
    } catch {
      setEventsError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.id]);

  // Fetch AmaTur events
  const fetchAmatur = useCallback(async () => {
    setAmaturLoading(true);
    const { data, error } = await getAmaturEvents();
    if (error && data.length === 0) {
      Alert.alert(s('error'), s('ampiLoadError'));
    }
    setAmaturEvents(data);
    setAmaturLoading(false);
  }, [s]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'amatur') {
      await fetchAmatur();
    } else {
      await fetchEvents(true);
    }
    setRefreshing(false);
  }, [fetchEvents, fetchAmatur, activeTab]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Fetch friends list once
  useEffect(() => {
    if (!user?.id) return;
    getFriendIds(user.id).then((ids) => {
      setFriendIds(new Set(ids));
    });
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'amatur' && amaturEvents.length === 0) {
      fetchAmatur();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const openDetail = useCallback(async (event: EventListItem) => {
    trackProductEvent(ProductEvents.eventOpened, {
      eventId: event.id,
      tab: activeTab,
      eventType: event.event_type,
    });
    setSelectedEvent(event);
    setDetailLoading(true);
    setDetailFeedback([]);
    const [partRes, fbRes] = await Promise.all([
      getEventParticipants(event.id),
      isPast(event) && event.status !== 'cancelled' ? getEventFeedback(event.id) : Promise.resolve({ data: [] }),
    ]);
    setDetailParticipants(partRes.data ?? []);
    setDetailFeedback(fbRes.data ?? []);
    setDetailLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  const closeDetail = useCallback(() => {
    setSelectedEvent(null);
    setDetailParticipants([]);
    setDetailFeedback([]);
    setShowAddChallenge(false);
    setUpdateText('');
    setDescExpanded(false);
  }, []);

  const challengeTitle = useCallback((challenge: {
    challenge_legacy_code?: string | null;
    challenge_title_key?: string | null;
    challenge_title?: string | null;
    legacy_code?: string | null;
    title_key?: string | null;
    title?: string | null;
  }) => resolveChallengeTitle(s, challenge as DbChallenge | EventChallengeSubmission), [s]);

  const handleAddChallengeToEvent = useCallback(async (challenge: DbChallenge) => {
    if (!user || !selectedEvent) return;
    setChallengeActionId(challenge.id);
    const { error } = await addEventChallenge(challenge);
    setChallengeActionId(null);
    if (error) {
      Alert.alert(s('error'), error.message);
      return;
    }
    trackProductEvent(ProductEvents.eventChallengeAttached, {
      eventId: selectedEvent.id,
      challengeId: challenge.id,
      category: challenge.category,
    });
    if (currentEventChallenge?.id === challenge.id) {
      setCurrentSelectedChallenge(null);
    }
    setShowAddChallenge(false);
  }, [addEventChallenge, currentEventChallenge?.id, s, selectedEvent, user]);

  const handleAwardEventChallenge = useCallback(async (submission: EventChallengeSubmission) => {
    if (!selectedEvent) return;
    setChallengeActionId(submission.submission_id);
    const { error } = await awardEventChallenge(submission.submission_id);
    setChallengeActionId(null);
    if (error) {
      Alert.alert(s('error'), error.message);
      return;
    }
    trackProductEvent(ProductEvents.eventChallengeAwarded, {
      eventId: selectedEvent.id,
      submissionId: submission.submission_id,
      category: submission.category,
    });
  }, [awardEventChallenge, s, selectedEvent]);

  // Open event detail when navigated with ?eventId=... (e.g. from a notification)
  const handledEventIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!eventIdParam || handledEventIdRef.current === eventIdParam) return;
    const parsed = Number(eventIdParam);
    if (!Number.isFinite(parsed)) return;
    handledEventIdRef.current = eventIdParam;
    (async () => {
      const { data } = await getEventById(parsed);
      if (data) {
        if (new Date((data as any).starts_at).getTime() < Date.now()) {
          setActiveTab('past');
        }
        await openDetail(data as EventListItem);
      }
    })();
  }, [eventIdParam, openDetail]);

  const handleJoin = useCallback(async (event: EventListItem) => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    const isJoined = event.event_participants?.some(
      (p: any) => p.user_id === user.id,
    );
    if (isJoined) {
      const { error } = await leaveEvent(event.id, user.id);
      if (error) {
        Alert.alert(s('error'), s('leaveError'));
        return;
      }
    } else {
      const { error } = await joinEvent(event.id, user.id);
      if (error) {
        Alert.alert(s('error'), s('joinError'));
        return;
      }
    }
    trackProductEvent(ProductEvents.eventJoined, {
      eventId: event.id,
      action: isJoined ? 'leave' : 'join',
    });
    fetchEvents();
    if (selectedEvent?.id === event.id) {
      const { data } = await getEventParticipants(event.id);
      setDetailParticipants(data ?? []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchEvents, selectedEvent]);

  const locale = lang === 'en' ? 'en-GB' : 'ro-RO';

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
    if (event.status === 'cancelled' || event.status === 'completed') return false;
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
    if (isInProgress(event)) {
      return { text: s('inProgress'), bg: colors.primaryPale, color: colors.primaryLight, icon: 'timer' as string | undefined };
    }
    if (event.status === 'confirmed') {
      return { text: s('confirmed'), bg: colors.primaryPale, color: colors.primaryMid, icon: undefined as string | undefined };
    }
    if (event.event_type === 'tournament') {
      return { text: s('tournament'), bg: colors.bluePale, color: colors.blue, icon: undefined as string | undefined };
    }
    return { text: s('open'), bg: colors.amberPale, color: colors.accent, icon: undefined as string | undefined };
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
        <Text style={styles.headerTitle}>{s('events')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <FeedbackHeaderButton color={headerFg} />
          <NotificationBellButton color={headerFg} />
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        {/* Tabs */}
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

        {activeTab !== 'amatur' && currentEventChallenge && (
          <TouchableOpacity
            style={styles.readyChallengeBanner}
            activeOpacity={0.86}
            onPress={() => setActiveTab('upcoming')}
          >
            <View style={styles.readyChallengeIcon}>
              <Lucide name="target" size={17} color={colors.textOnPrimary} />
            </View>
            <View style={styles.readyChallengeCopy}>
              <Text style={styles.readyChallengeTitle}>{s('eventReadyChallengeTitle')}</Text>
              <Text style={styles.readyChallengeText} numberOfLines={2}>
                {challengeTitle(currentEventChallenge)}
              </Text>
            </View>
            <Text style={styles.readyChallengeCta}>{s('eventReadyChallengeCta')}</Text>
          </TouchableOpacity>
        )}

        {/* Event Cards — regular tabs */}
        {activeTab !== 'amatur' && (
          loading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <SkeletonList count={3}><EventCardSkeleton /></SkeletonList>
            </View>
          ) : eventsError ? (
            <ErrorState
              title={s('eventsLoadError')}
              description={s('eventsLoadErrorDesc')}
              ctaLabel={s('retry')}
              onRetry={fetchEvents}
            />
          ) : events.length === 0 ? (
            <EmptyState
              icon="calendar"
              title={s('emptyEventsTitle')}
              description={s('emptyEventsDesc')}
              ctaLabel={user ? s('emptyEventsCta') : undefined}
              onCtaPress={user ? () => router.push('/(protected)/create-event' as any) : undefined}
              iconColor={colors.accentBright}
              iconBg={colors.amberPale}
            />
          ) : (
            <View style={styles.eventsList}>
              {events.map((event, index) => {
                const badge = getBadgeInfo(event);
                const isJoined = event.event_participants?.some(
                  (p: any) => p.user_id === user?.id,
                );
                const participants = event.event_participants ?? [];
                const venueName = event.venues?.name ?? s('unknownVenue');

                return (
                  <Animated.View key={event.id} entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
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
                            {participants.length}/{event.max_participants ?? '\u221E'} {s('spots')}
                          </Text>
                        </View>
                        {activeTab !== 'past' && !isPast(event) && event.organizer_id !== user?.id && (
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
                          const myRow = (event.event_participants ?? []).find((p: any) => p.user_id === user?.id);
                          const canInteract = !!myRow || event.organizer_id === user?.id;
                          if (!canInteract) return null;
                          const loggedHours = Number(myRow?.hours_played ?? 0);
                          const hasLoggedHours = loggedHours > 0;
                          const hasGivenFeedback = feedbackGivenIds.has(event.id);
                          return (
                            <View style={{ flexDirection: 'row', gap: 6 }}>
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
                  </Animated.View>
                );
              })}
            </View>
          )
        )}

        {/* AmaTur tab content */}
        {activeTab === 'amatur' && (
          amaturLoading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <SkeletonList count={3}><EventCardSkeleton /></SkeletonList>
            </View>
          ) : (
            <>
              {amaturEvents.length === 0 ? (
                <EmptyState
                  icon="trophy"
                  title={s('ampiEmptyTitle')}
                  description={s('ampiEmptyDesc')}
                  iconColor={colors.blue}
                  iconBg={colors.bluePale}
                />
              ) : (
                <View style={styles.eventsList}>
                  {amaturEvents.map((ev, index) => {
                    return (
                      <Animated.View key={ev.id} entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
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
                      </Animated.View>
                    );
                  })}

                  {/* Attribution */}
                  <Text style={styles.amaturAttribution}>{s('ampiPoweredBy')}</Text>
                </View>
              )}
            </>
          )
        )}
      </ScrollView>

      {/* FAB — Create Event */}
      {user && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(protected)/create-event' as any)}
          activeOpacity={0.8}
          testID="create-event-fab"
        >
          <Lucide name="plus" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
      )}

      {/* ===== Event Detail Expandable Sheet ===== */}
      <EventDetailSheet
        visible={selectedEvent !== null}
        onClose={closeDetail}
        colors={colors}
        ms={ms}
        insets={insets}
      >
            {selectedEvent && (
              <EventDetailContent
                event={selectedEvent}
                user={user ? { id: user.id } : null}
                friendIds={friendIds}
                detailParticipants={detailParticipants}
                detailFeedback={detailFeedback}
                detailLoading={detailLoading}
                detailChallenges={detailChallenges}
                feedbackGivenIds={feedbackGivenIds}
                showAddChallenge={showAddChallenge}
                setShowAddChallenge={setShowAddChallenge}
                eventChallengeTrack={eventChallengeTrack}
                setEventChallengeTrackId={setEventChallengeTrackId}
                challengeActionId={challengeActionId}
                eventChallengeChoices={eventChallengeChoices}
                currentEventChallenge={currentEventChallenge}
                descExpanded={descExpanded}
                setDescExpanded={setDescExpanded}
                updateText={updateText}
                setUpdateText={setUpdateText}
                sendingUpdate={sendingUpdate}
                setSendingUpdate={setSendingUpdate}
                formatDate={formatDate}
                formatTime={formatTime}
                isEffectivelyOver={isEffectivelyOver}
                onAddChallenge={handleAddChallengeToEvent}
                onAwardChallenge={handleAwardEventChallenge}
                onJoin={handleJoin}
                challengeTitle={challengeTitle}
                closeDetail={closeDetail}
                setFeedbackEventId={setFeedbackEventId}
                setLogHoursEvent={setLogHoursEvent}
                setInviteModalVisible={setInviteModalVisible}
                fetchEvents={fetchEvents}
              />
            )}
      </EventDetailSheet>

      {user && selectedEvent && (
        <FriendPickerModal
          visible={inviteModalVisible}
          userId={user.id}
          onConfirm={async (ids) => {
            setInviteModalVisible(false);
            if (ids.length > 0) {
              await sendEventInvites(selectedEvent.id, ids, user.id);
            }
          }}
          onClose={() => setInviteModalVisible(false)}
        />
      )}

      <WriteEventFeedbackScreen
        visible={feedbackEventId !== null}
        eventId={feedbackEventId}
        onDismiss={() => {
          if (feedbackEventId) setFeedbackGivenIds(prev => new Set(prev).add(feedbackEventId));
          setFeedbackEventId(null);
          fetchEvents();
        }}
      />

      <LogHoursModal
        visible={logHoursEvent !== null}
        eventId={logHoursEvent?.id ?? null}
        eventTitle={logHoursEvent?.title}
        initialHours={logHoursEvent?.initialHours}
        onDismiss={() => {
          setLogHoursEvent(null);
          fetchEvents();
        }}
      />

      <AmaturDetailSheet
        event={selectedAmatur}
        bottomInset={insets.bottom}
        onClose={() => setSelectedAmatur(null)}
      />
    </View>
  );
}
