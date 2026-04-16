import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Pressable, RefreshControl, Linking } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { Lucide } from '../components/Icon';
import { NotificationBellButton } from '../components/NotificationBellButton';
import { Card } from '../components/Card';
import { EventCardSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getEvents, getEventParticipants, joinEvent, leaveEvent, cancelEvent, stopRecurrence, sendEventInvites, sendEventUpdate } from '../services/events';
import { getEventFeedback, getUserEventFeedback } from '../services/eventFeedback';
import { getFriendIds } from '../services/friends';
import { FriendPickerModal } from '../components/FriendPickerModal';
import { WriteEventFeedbackScreen } from './WriteEventFeedbackScreen';
import { hapticMedium } from '../lib/haptics';
import { getAmaturEvents, type AmaturEvent } from '../services/amatur';
import { EventDetailSheet } from '../components/EventDetailSheet';
import { BADGE_TRACKS } from '../lib/badgeChallenges';
import {
  resolveChallengeTitle,
  type ChallengeCategory,
  type DbChallenge,
  type EventChallengeSubmission,
  useChallengeChoices,
  useEventChallenges,
} from '../features/challenges';

type EventTab = 'upcoming' | 'past' | 'mine' | 'amatur';

interface EventSchedulingScreenProps {
  hideTabBar?: boolean;
}

export function EventSchedulingScreen({ hideTabBar = false }: EventSchedulingScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const { styles, ms } = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const eventChallengeTrack = BADGE_TRACKS.find((badge) => badge.id === eventChallengeTrackId) ?? BADGE_TRACKS[0];
  const {
    choices: eventChallengeChoices,
  } = useChallengeChoices(eventChallengeTrack.category as ChallengeCategory, {
    enabled: showAddChallenge && !!selectedEvent,
    onlyOtherPlayer: true,
  });
  const {
    addChallenge: addEventChallenge,
    awardChallenge: awardEventChallenge,
    challenges: detailChallenges,
  } = useEventChallenges(selectedEvent?.id, user?.id);

  const fetchEvents = useCallback(async () => {
    if (activeTab === 'amatur') return;
    setLoading(true);
    try {
      const tab = activeTab as 'upcoming' | 'past' | 'mine';
      const { data, error } = await getEvents(
        tab,
        (tab === 'mine' || tab === 'past') ? user?.id : undefined,
      );
      if (error) {
        Alert.alert(s('error'), s('eventsLoadError'));
      } else {
        setEvents(data ?? []);
        // Check which past events already have user feedback
        if (tab === 'past' && user?.id && data?.length) {
          const checks = await Promise.all(
            data.map((ev: any) => getUserEventFeedback(ev.id, user.id)),
          );
          const givenIds = new Set<number>();
          data.forEach((ev: any, i: number) => {
            if (checks[i].data) givenIds.add(ev.id);
          });
          setFeedbackGivenIds(givenIds);
        }
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await fetchEvents();
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

  const openDetail = useCallback(async (event: any) => {
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
  }, [user?.id]);

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
    setShowAddChallenge(false);
  }, [addEventChallenge, s, selectedEvent, user]);

  const handleAwardEventChallenge = useCallback(async (submission: EventChallengeSubmission) => {
    if (!selectedEvent) return;
    setChallengeActionId(submission.submission_id);
    const { error } = await awardEventChallenge(submission.submission_id);
    setChallengeActionId(null);
    if (error) {
      Alert.alert(s('error'), error.message);
      return;
    }
  }, [awardEventChallenge, s, selectedEvent]);

  const handleJoin = useCallback(async (event: any) => {
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

  const getBadgeInfo = useCallback((event: any) => {
    if (event.status === 'completed' || (event.status !== 'cancelled' && isEffectivelyOver(event))) {
      return { text: s('completed'), bg: colors.borderLight, color: colors.textMuted };
    }
    if (event.status === 'cancelled') {
      return { text: s('cancelled'), bg: colors.cancelledBadgeBg, color: colors.red };
    }
    if (event.status === 'confirmed') {
      return { text: s('confirmed'), bg: colors.primaryPale, color: colors.primaryMid };
    }
    if (event.event_type === 'tournament') {
      return { text: s('tournament'), bg: colors.bluePale, color: colors.blue };
    }
    return { text: s('open'), bg: colors.amberPale, color: colors.accent };
  }, [colors, s, isEffectivelyOver]);

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

  const getDuration = (start: string, end?: string) => {
    if (!end) return null;
    const msVal = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.round(msVal / 3600000);
    return hours > 0 ? hours : null;
  };

  const isPast = (event: any) =>
    event.status === 'completed' || event.status === 'cancelled' || isEffectivelyOver(event);

  // Separate friend participants from others
  const friendParticipants = detailParticipants.filter(
    (p) => friendIds.has(p.user_id),
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('events')}</Text>
        <NotificationBellButton color={headerFg} />
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

        {/* Event Cards — regular tabs */}
        {activeTab !== 'amatur' && (
          loading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <SkeletonList count={3}><EventCardSkeleton /></SkeletonList>
            </View>
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
                        <View style={[styles.eventBadge, { backgroundColor: badge.bg }]}>
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
                        {isPast(event) && event.status !== 'cancelled' && isJoined && event.organizer_id !== user?.id && !feedbackGivenIds.has(event.id) && (
                          <TouchableOpacity
                            style={[styles.joinBtn, styles.notJoinedBtn]}
                            onPress={(e) => { e?.stopPropagation?.(); setFeedbackEventId(event.id); }}
                          >
                            <Lucide name="message-square" size={14} color={colors.primary} />
                            <Text style={[styles.joinText, styles.notJoinedText]}>{s('giveFeedback')}</Text>
                          </TouchableOpacity>
                        )}
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
            {selectedEvent && (() => {
              const ev = selectedEvent;
              const badge = getBadgeInfo(ev);
              const venueName = ev.venues?.name ?? s('unknownVenue');
              const venueCity = ev.venues?.city ?? '';
              const venueLat = ev.venues?.lat as number | null;
              const venueLng = ev.venues?.lng as number | null;
              const isJoined = ev.event_participants?.some((p: any) => p.user_id === user?.id);
              const duration = getDuration(ev.starts_at, ev.ends_at);
              const userEventChallenge = detailChallenges.find((submission) => (
                submission.submitter_user_id === user?.id
                && ['pending', 'approved', 'auto_approved'].includes(submission.status)
              ));

              return (
                <>

                  {/* Title row */}
                  <View style={ms.titleRow}>
                    <Text style={ms.title} numberOfLines={2}>
                      {ev.title || venueName}
                    </Text>
                    <View style={[styles.eventBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.eventBadgeText, { color: badge.color }]}>
                        {badge.text}
                      </Text>
                    </View>
                  </View>

                  {/* Info rows */}
                  <View style={ms.infoBlock}>
                    <View style={ms.infoRow}>
                      <Lucide name="calendar" size={16} color={colors.accentBright} />
                      <Text style={ms.infoText} numberOfLines={1}>
                        {formatDate(ev.starts_at)} {'\u00B7'} {formatTime(ev.starts_at)}
                        {ev.ends_at ? ` – ${formatTime(ev.ends_at)}` : ''}
                      </Text>
                      {duration != null && (
                        <View style={ms.durationChip}>
                          <Lucide name="clock" size={12} color={colors.textFaint} />
                          <Text style={ms.durationChipText}>{duration}h</Text>
                        </View>
                      )}
                    </View>

                    <View style={ms.infoRow}>
                      <Lucide name="map-pin" size={16} color={colors.primaryMid} />
                      <Text style={ms.infoText} numberOfLines={1}>
                        {venueName}{venueCity ? `, ${venueCity}` : ''}
                      </Text>
                      {ev.event_type === 'tournament' && (
                        <View style={ms.durationChip}>
                          <Lucide name="trophy" size={12} color={colors.amber} />
                          <Text style={[ms.durationChipText, { color: colors.amber }]}>{s('tournament')}</Text>
                        </View>
                      )}
                    </View>

                    {ev.table_number != null && (
                      <View style={ms.infoRow}>
                        <Lucide name="hash" size={16} color={colors.textFaint} />
                        <Text style={ms.infoText}>
                          {s('tableNumber')} {ev.table_number}
                        </Text>
                      </View>
                    )}

                    {ev.recurrence_rule && (
                      <View style={ms.infoRow}>
                        <Lucide name="repeat" size={16} color={colors.purple} />
                        <Text style={ms.infoText}>
                          {ev.recurrence_rule === 'daily' ? s('recurringDaily') :
                           ev.recurrence_rule === 'weekly' ? s('recurringWeekly') :
                           s('recurringMonthly')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Description */}
                  <View style={ms.section}>
                    <Text style={ms.sectionTitle}>{s('description')}</Text>
                    <Text
                      style={ms.descText}
                      numberOfLines={descExpanded ? undefined : 4}
                    >
                      {ev.description || s('noDescription')}
                    </Text>
                    {ev.description && ev.description.length > 120 && !descExpanded && (
                      <TouchableOpacity onPress={() => setDescExpanded(true)}>
                        <Text style={ms.showMoreText}>...{lang === 'ro' ? 'mai mult' : 'more'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Map & Navigation */}
                  {venueLat != null && venueLng != null && (
                    <>
                      <View style={styles.amaturMapWrap}>
                        <MapView
                          style={styles.amaturMap}
                          initialRegion={{
                            latitude: venueLat,
                            longitude: venueLng,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                          }}
                          scrollEnabled={false}
                          zoomEnabled={false}
                          rotateEnabled={false}
                          pitchEnabled={false}
                        >
                          <Marker
                            coordinate={{ latitude: venueLat, longitude: venueLng }}
                            title={venueName}
                            description={venueCity || undefined}
                          />
                        </MapView>
                      </View>
                      <View style={styles.amaturNavSection}>
                        <View style={styles.amaturNavRow}>
                          <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://maps.google.com/?q=${venueLat},${venueLng}`)}>
                            <Lucide name="navigation" size={14} color={colors.textMuted} />
                            <Text style={styles.amaturNavBtnText}>Google</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://maps.apple.com/?q=${venueLat},${venueLng}`)}>
                            <Lucide name="navigation" size={14} color={colors.textMuted} />
                            <Text style={styles.amaturNavBtnText}>Apple</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://waze.com/ul?ll=${venueLat},${venueLng}&navigate=yes`)}>
                            <Lucide name="navigation" size={14} color={colors.textMuted} />
                            <Text style={styles.amaturNavBtnText}>Waze</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Participants — horizontal avatar strip */}
                  <View style={ms.section}>
                    <View style={ms.sectionHeader}>
                      <Text style={ms.sectionTitle}>
                        {s('participants')}
                        {friendParticipants.length > 0
                          ? ` (${friendParticipants.length} ${friendParticipants.length === 1 ? (lang === 'ro' ? 'prieten' : 'friend') : (lang === 'ro' ? 'prieteni' : 'friends')})`
                          : ''}
                      </Text>
                      <Text style={ms.countBadge}>
                        {detailParticipants.length}/{ev.max_participants ?? '\u221E'}
                      </Text>
                    </View>

                    {detailLoading ? (
                      <ActivityIndicator size="small" color={colors.accentBright} style={{ marginVertical: 12 }} />
                    ) : detailParticipants.length === 0 ? (
                      <Text style={ms.emptyText}>{s('noEvents')}</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.pHScroll} contentContainerStyle={ms.pHScrollContent}>
                        {detailParticipants.slice(0, 30).map((p) => {
                          const profile = p.profiles;
                          const fullName = profile?.full_name ?? '??';
                          const nameParts = fullName.split(' ').filter(Boolean);
                          const shortName = nameParts.length >= 2
                            ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                            : nameParts[0] ?? '??';
                          const isOrganizer = p.user_id === ev.organizer_id;
                          const isMe = p.user_id === user?.id;
                          return (
                            <View key={p.user_id} style={ms.pHItem}>
                              <View style={[ms.pAvatar, { backgroundColor: getAvatarColor(p.user_id) }]}>
                                <Text style={ms.pInitials}>{getInitials(fullName)}</Text>
                                {isOrganizer && (
                                  <View style={ms.pOrgBadge}>
                                    <Lucide name="star" size={8} color={colors.amber} />
                                  </View>
                                )}
                              </View>
                              <Text style={ms.pHName} numberOfLines={1}>
                                {isMe ? s('you') : shortName}
                              </Text>
                            </View>
                          );
                        })}
                        {detailParticipants.length > 30 && (
                          <View style={ms.pHItem}>
                            <View style={[ms.pAvatar, { backgroundColor: colors.bgMuted }]}>
                              <Text style={[ms.pInitials, { color: colors.textMuted }]}>+{detailParticipants.length - 30}</Text>
                            </View>
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </View>

                  {/* Event challenge validation */}
                  {user && isJoined && ev.status !== 'cancelled' && (
                    <View style={ms.section}>
                      <View style={ms.sectionHeader}>
                        <View>
                          <Text style={ms.sectionTitle}>{s('eventChallenges')}</Text>
                          <Text style={styles.challengeSectionHint}>{s('eventChallengesDesc')}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.challengeAddBtn, userEventChallenge && styles.disabledChallenge]}
                          disabled={!!userEventChallenge}
                          onPress={() => setShowAddChallenge((value) => !value)}
                        >
                          <Lucide name={showAddChallenge ? 'x' : 'plus'} size={14} color={colors.primary} />
                          <Text style={styles.challengeAddText}>
                            {userEventChallenge
                              ? s('eventChallengeAlreadyAdded')
                              : showAddChallenge
                                ? s('cancel')
                                : s('eventAddChallenge')}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {showAddChallenge && (
                        <View style={styles.eventChallengePicker}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventChallengeTracks}>
                            {BADGE_TRACKS.map((track) => {
                              const active = track.id === eventChallengeTrack.id;
                              return (
                                <TouchableOpacity
                                  key={track.id}
                                  style={[styles.eventChallengeTrack, active && { borderColor: track.color, backgroundColor: track.paleColor }]}
                                  onPress={() => setEventChallengeTrackId(track.id)}
                                >
                                  <Lucide name={track.icon} size={14} color={active ? track.color : colors.textMuted} />
                                  <Text style={[styles.eventChallengeTrackText, active && { color: track.color }]}>
                                    {s(`badgeTrack_${track.id}_short`)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>

                          {eventChallengeChoices.length > 0 ? (
                            <View style={styles.eventChallengeChoiceList}>
                              {eventChallengeChoices.map((challenge) => (
                                <TouchableOpacity
                                  key={challenge.id}
                                  style={[styles.eventChallengeChoice, challengeActionId === challenge.id && styles.disabledChallenge]}
                                  disabled={!!challengeActionId}
                                  onPress={() => handleAddChallengeToEvent(challenge)}
                                >
                                  <Text style={styles.eventChallengeChoiceTitle}>{challengeTitle(challenge)}</Text>
                                  <Text style={styles.eventChallengeChoiceCta}>
                                    {challengeActionId === challenge.id ? s('loading') : s('eventAttachChallenge')}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : (
                            <Text style={ms.emptyText}>{s('eventNoOtherChallenges')}</Text>
                          )}
                        </View>
                      )}

                      {detailChallenges.length > 0 ? (
                        <View style={styles.eventChallengeList}>
                          {detailChallenges.map((submission) => {
                            const isMine = submission.submitter_user_id === user.id;
                            const isPending = submission.status === 'pending';
                            const canAward = !isMine && isPending;
                            return (
                              <View key={submission.submission_id} style={styles.eventChallengeCard}>
                                <View style={styles.eventChallengeCardTop}>
                                  <View style={styles.eventChallengeIcon}>
                                    <Lucide name={isPending ? 'award' : 'check'} size={16} color={colors.textOnPrimary} />
                                  </View>
                                  <View style={styles.eventChallengeCardCopy}>
                                    <Text style={styles.eventChallengeCardTitle}>{challengeTitle(submission)}</Text>
                                    <Text style={styles.eventChallengeCardMeta}>
                                      {isMine
                                        ? s('eventChallengeMine')
                                        : s('eventChallengeBy', submission.submitter_name)}
                                    </Text>
                                    {!isPending && (
                                      <Text style={styles.eventChallengeCardMeta}>
                                        {s('eventChallengeAwardedBy', submission.reviewer_name ?? s('player'))}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                                {canAward ? (
                                  <TouchableOpacity
                                    style={[styles.eventAwardBtn, challengeActionId === submission.submission_id && styles.disabledChallenge]}
                                    disabled={!!challengeActionId}
                                    onPress={() => handleAwardEventChallenge(submission)}
                                  >
                                    <Text style={styles.eventAwardBtnText}>
                                      {challengeActionId === submission.submission_id ? s('loading') : s('eventAwardChallenge')}
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <View style={[styles.eventChallengeStatus, isPending ? styles.eventChallengePending : styles.eventChallengeAwarded]}>
                                    <Text style={styles.eventChallengeStatusText}>
                                      {isPending ? s('challengeAwaitingApproval') : s('eventChallengeAwarded')}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={ms.emptyText}>{s('eventNoChallenges')}</Text>
                      )}
                    </View>
                  )}

                  {/* Reviews / Feedback */}
                  {isPast(ev) && ev.status !== 'cancelled' && detailFeedback.length > 0 && (
                    <View style={ms.section}>
                      <View style={ms.sectionHeader}>
                        <Text style={ms.sectionTitle}>{s('feedback')}</Text>
                        <Text style={ms.countBadge}>
                          {(detailFeedback.reduce((sum: number, f: any) => sum + f.rating, 0) / detailFeedback.length).toFixed(1)}{'\u2605'} ({detailFeedback.length})
                        </Text>
                      </View>
                      {detailFeedback.map((fb: any) => (
                        <View key={fb.id} style={ms.feedbackCard}>
                          <View style={ms.feedbackHeader}>
                            <Text style={ms.feedbackName}>{fb.reviewer_name || s('anon')}</Text>
                            <Text style={ms.feedbackRating}>{fb.rating}{'\u2605'} · {Number(fb.hours_played)}h</Text>
                          </View>
                          {fb.body ? <Text style={ms.feedbackBody}>{fb.body}</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Organizer: send update to participants */}
                  {ev.organizer_id === user?.id && detailParticipants.length > 0 && (
                    <View style={ms.updateInline}>
                      <TextInput
                        style={ms.updateInlineInput}
                        placeholder={s('updatePlaceholder')}
                        placeholderTextColor={colors.textFaint}
                        value={updateText}
                        onChangeText={setUpdateText}
                        multiline
                      />
                      <TouchableOpacity
                        style={[ms.updateInlineBtn, (sendingUpdate || !updateText.trim()) && { opacity: 0.3 }]}
                        disabled={sendingUpdate || !updateText.trim()}
                        onPress={async () => {
                          setSendingUpdate(true);
                          const { error } = await sendEventUpdate(ev.id, updateText.trim(), user!.id);
                          setSendingUpdate(false);
                          if (error) {
                            Alert.alert(s('error'), error.message);
                          } else {
                            setUpdateText('');
                            Alert.alert(s('success'), s('updateSent'));
                          }
                        }}
                      >
                        {sendingUpdate
                          ? <ActivityIndicator size="small" color={colors.accent} />
                          : <Lucide name="megaphone" size={18} color={colors.accent} />
                        }
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={ms.actions}>
                    {isPast(ev) && ev.status !== 'cancelled' && isJoined && ev.organizer_id !== user?.id && !feedbackGivenIds.has(ev.id) && (
                      <TouchableOpacity
                        style={[ms.actionBtn, ms.actionJoin]}
                        onPress={() => { closeDetail(); setFeedbackEventId(ev.id); }}
                      >
                        <Lucide name="message-square" size={16} color={colors.textOnPrimary} />
                        <Text style={[ms.actionText, ms.actionJoinText]}>{s('giveFeedback')}</Text>
                      </TouchableOpacity>
                    )}
                    {!isPast(ev) && ev.organizer_id !== user?.id && (
                      <TouchableOpacity
                        style={[ms.actionBtn, isJoined ? ms.actionLeave : ms.actionJoin]}
                        onPress={() => handleJoin(ev)}
                      >
                        <Lucide
                          name={isJoined ? 'log-out' : 'user-plus'}
                          size={16}
                          color={isJoined ? colors.red : colors.textOnPrimary}
                        />
                        <Text style={[ms.actionText, isJoined ? ms.actionLeaveText : ms.actionJoinText]}>
                          {isJoined ? s('joined') : s('join')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!isPast(ev) && ev.organizer_id === user?.id && (
                      <TouchableOpacity
                        style={[ms.actionBtn, ms.actionInvite]}
                        onPress={() => setInviteModalVisible(true)}
                      >
                        <Lucide name="send" size={16} color={colors.purple} />
                        <Text style={[ms.actionText, ms.actionInviteText]}>
                          {s('inviteToEvent')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={ms.closeBtn} onPress={closeDetail}>
                      <Text style={ms.closeBtnText}>{s('close')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Danger zone — separated from main actions */}
                  {!isPast(ev) && ev.organizer_id === user?.id && (
                    <View style={ms.dangerZone}>
                      {ev.recurrence_rule && (
                        <TouchableOpacity
                          style={ms.dangerBtn}
                          onPress={() => {
                            Alert.alert(
                              s('stopRecurrence'),
                              s('stopRecurrenceConfirm'),
                              [
                                { text: s('cancel'), style: 'cancel' },
                                {
                                  text: s('stopRecurrence'),
                                  style: 'destructive',
                                  onPress: async () => {
                                    const { error } = await stopRecurrence(ev.id, user!.id);
                                    if (error) {
                                      Alert.alert(s('error'), error.message);
                                    } else {
                                      closeDetail();
                                      fetchEvents();
                                    }
                                  },
                                },
                              ],
                            );
                          }}
                        >
                          <Lucide name="repeat" size={14} color={colors.textOnPrimary} />
                          <Text style={ms.dangerBtnText}>
                            {s('stopRecurrence')}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={ms.dangerBtn}
                        onPress={() => {
                          Alert.alert(
                            s('cancelEvent'),
                            s('cancelEventConfirm'),
                            [
                              { text: s('cancel'), style: 'cancel' },
                              {
                                text: s('cancelEvent'),
                                style: 'destructive',
                                onPress: async () => {
                                  const { error } = await cancelEvent(ev.id, user!.id);
                                  if (error) {
                                    Alert.alert(s('error'), error.message);
                                  } else {
                                    closeDetail();
                                    fetchEvents();
                                  }
                                },
                              },
                            ],
                          );
                        }}
                      >
                        <Lucide name="x-circle" size={14} color={colors.textOnPrimary} />
                        <Text style={ms.dangerBtnText}>{s('cancelEvent')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              );
            })()}
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

      {/* ===== AmaTur Detail Bottom Sheet ===== */}
      <Modal
        visible={selectedAmatur !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAmatur(null)}
      >
        <Pressable style={ms.overlay} onPress={() => setSelectedAmatur(null)}>
          <Pressable style={[ms.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            {selectedAmatur && (() => {
              const ev = selectedAmatur;

              return (
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                  <View style={ms.handleWrap}>
                    <View style={ms.handle} />
                  </View>

                  {/* Title */}
                  <View style={ms.titleRow}>
                    <Text style={ms.title} numberOfLines={2}>
                      {ev.name || ev.city}
                    </Text>
                    {ev.tables != null && (
                      <View style={[styles.eventBadge, { backgroundColor: colors.bluePale }]}>
                        <Text style={[styles.eventBadgeText, { color: colors.blue }]}>
                          {ev.tables} {s('tables')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={ms.infoBlock}>
                    <View style={ms.infoRow}>
                      <Lucide name="calendar" size={16} color={colors.accentBright} />
                      <Text style={ms.infoText}>
                        {ev.startDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>

                    <View style={ms.infoRow}>
                      <Lucide name="map-pin" size={16} color={colors.primaryMid} />
                      <Text style={ms.infoText}>{ev.city}</Text>
                    </View>

                    {ev.address && (
                      <View style={ms.infoRow}>
                        <Lucide name="home" size={16} color={colors.textFaint} />
                        <Text style={ms.infoText}>{ev.address}</Text>
                      </View>
                    )}

                    {ev.categories.length > 0 && (
                      <View style={ms.infoRow}>
                        <Lucide name="list" size={16} color={colors.blue} />
                        <Text style={ms.infoText}>
                          {ev.categories.join('  /  ')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Per-category spots */}
                  {ev.categorySpots.length > 0 && (
                    <View style={styles.amaturSpotsDetail}>
                      {ev.categorySpots.map((cs) => (
                        <View key={cs.category} style={styles.amaturSpotDetailRow}>
                          <Text style={styles.amaturSpotDetailLabel}>{cs.category}</Text>
                          <Text style={styles.amaturSpotDetailValue}>{cs.spots} {s('spots')}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Map */}
                  {ev.latitude != null && ev.longitude != null && (
                    <View style={styles.amaturMapWrap}>
                      <MapView
                        style={styles.amaturMap}
                        initialRegion={{
                          latitude: ev.latitude,
                          longitude: ev.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                      >
                        <Marker
                          coordinate={{ latitude: ev.latitude, longitude: ev.longitude }}
                          title={ev.city}
                          description={ev.address ?? undefined}
                        />
                      </MapView>
                    </View>
                  )}

                  {/* Navigation */}
                  {ev.latitude != null && ev.longitude != null && (
                    <View style={styles.amaturNavSection}>
                      <View style={styles.amaturNavRow}>
                        <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://maps.google.com/?q=${ev.latitude},${ev.longitude}`)}>
                          <Lucide name="navigation" size={14} color={colors.textMuted} />
                          <Text style={styles.amaturNavBtnText}>Google</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://maps.apple.com/?q=${ev.latitude},${ev.longitude}`)}>
                          <Lucide name="navigation" size={14} color={colors.textMuted} />
                          <Text style={styles.amaturNavBtnText}>Apple</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.amaturNavBtn} onPress={() => Linking.openURL(`https://waze.com/ul?ll=${ev.latitude},${ev.longitude}&navigate=yes`)}>
                          <Lucide name="navigation" size={14} color={colors.textMuted} />
                          <Text style={styles.amaturNavBtnText}>Waze</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={ms.actions}>
                    {ev.forumUrl && (
                      <TouchableOpacity
                        style={[ms.actionBtn, ms.actionJoin]}
                        onPress={() => Linking.openURL(ev.forumUrl!)}
                      >
                        <Lucide name="external-link" size={16} color={colors.textOnPrimary} />
                        <Text style={[ms.actionText, ms.actionJoinText]}>
                          {s('ampiForumThread')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={ms.closeBtn} onPress={() => setSelectedAmatur(null)}>
                      <Text style={ms.closeBtnText}>{s('close')}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  const styles = StyleSheet.create({
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
      paddingHorizontal: Spacing.md,
      minHeight: 52,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentBright,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.lg,
    },
    scroll: {
      flex: 1,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.md,
    },
    tab: {
      flex: 1,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.accentBright,
    },
    tabText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textFaint,
    },
    tabTextActive: {
      fontWeight: FontWeight.semibold,
      color: colors.accentBright,
    },
    eventsList: {
      padding: Spacing.md,
      paddingTop: Spacing.sm,
      gap: Spacing.sm,
    },
    eventCard: {
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    eventTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    eventDateWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    eventDate: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    eventBadge: {
      borderRadius: Radius.md,
      paddingVertical: 3,
      paddingHorizontal: Spacing.xs,
    },
    eventBadgeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
    },
    eventMid: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    eventLocation: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    eventBot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stackAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bgAlt,
    },
    stackInitials: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    attendeesText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
      marginLeft: Spacing.xs,
    },
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      paddingVertical: 8,
      paddingHorizontal: Spacing.md,
      gap: 6,
      ...Shadows.sm,
    },
    joinedBtn: {
      backgroundColor: colors.primary,
      ...Shadows.md,
    },
    notJoinedBtn: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    joinText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
    },
    joinedText: {
      color: colors.textOnPrimary,
    },
    notJoinedText: {
      color: colors.primary,
    },
    amaturNavSection: {
      marginBottom: Spacing.md,
      gap: 10,
    },
    amaturNavRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    amaturNavBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.sm,
      height: 32,
      gap: 5,
    },
    amaturNavBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    amaturMapWrap: {
      borderRadius: Radius.md,
      overflow: 'hidden',
      marginBottom: Spacing.md,
      height: 160,
    },
    amaturMap: {
      width: '100%',
      height: '100%',
    },
    amaturSpotsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    amaturSpotChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.sm,
      paddingVertical: 3,
      paddingHorizontal: 8,
      gap: 4,
    },
    amaturSpotLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
    },
    amaturSpotValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    amaturSpotsDetail: {
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      gap: 6,
      marginBottom: Spacing.md,
    },
    amaturSpotDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    amaturSpotDetailLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    amaturSpotDetailValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    amaturCatRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    amaturCatText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    amaturAttribution: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
      textAlign: 'center',
      paddingVertical: Spacing.md,
    },
    challengeSectionHint: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
      maxWidth: 230,
    },
    challengeAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 9,
      paddingVertical: 7,
      backgroundColor: colors.bgAlt,
    },
    challengeAddText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.primary,
    },
    eventChallengePicker: {
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgMuted,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    eventChallengeTracks: {
      gap: Spacing.xs,
      paddingRight: Spacing.sm,
    },
    eventChallengeTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      paddingHorizontal: 9,
      paddingVertical: 7,
    },
    eventChallengeTrackText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    eventChallengeChoiceList: {
      gap: Spacing.xs,
    },
    eventChallengeChoice: {
      borderRadius: Radius.sm,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.sm,
      gap: 5,
    },
    eventChallengeChoiceTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    eventChallengeChoiceCta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.primary,
    },
    eventChallengeList: {
      gap: Spacing.sm,
    },
    eventChallengeCard: {
      borderRadius: Radius.md,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: Spacing.sm,
      gap: Spacing.sm,
    },
    eventChallengeCardTop: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    eventChallengeIcon: {
      width: 34,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentBright,
    },
    eventChallengeCardCopy: {
      flex: 1,
      gap: 3,
    },
    eventChallengeCardTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    eventChallengeCardMeta: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    eventAwardBtn: {
      alignItems: 'center',
      borderRadius: Radius.sm,
      backgroundColor: colors.greenDeep,
      paddingVertical: 10,
    },
    eventAwardBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    eventChallengeStatus: {
      alignSelf: 'flex-start',
      borderRadius: Radius.sm,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    eventChallengePending: {
      backgroundColor: colors.amberPale,
    },
    eventChallengeAwarded: {
      backgroundColor: colors.primaryPale,
    },
    eventChallengeStatusText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    disabledChallenge: {
      opacity: 0.65,
    },
  });

  /* ===== Bottom Sheet (modal) styles ===== */
  const ms = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      maxHeight: '85%',
      width: '100%',
      maxWidth: 430,
      ...Shadows.lg,
    },
    handleWrap: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      flex: 1,
    },
    infoBlock: {
      gap: 10,
      marginBottom: Spacing.lg,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    infoText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textMuted,
      flex: 1,
    },
    durationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: 4,
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.sm,
      paddingVertical: 2,
      paddingHorizontal: 8,
      marginLeft: 'auto',
    },
    durationChipText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
    },
    section: {
      marginBottom: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: 6,
    },
    countBadge: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.accentBright,
      marginBottom: 6,
    },
    descText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textMuted,
      lineHeight: 20,
    },
    showMoreText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.primary,
      marginTop: 4,
    },
    emptyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
      fontStyle: 'italic',
    },
    participantList: {
      gap: Spacing.xs,
    },
    pRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    pAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pAvatarFriend: {
      backgroundColor: colors.purpleMid,
    },
    pInitials: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    pHScroll: {
      marginHorizontal: -4,
    },
    pHScrollContent: {
      gap: Spacing.sm,
      paddingHorizontal: 4,
    },
    pHItem: {
      alignItems: 'center',
      width: 52,
    },
    pHName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    pOrgBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pInfo: {
      flex: 1,
    },
    pName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.medium,
      color: colors.text,
    },
    pBadge: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    updateInline: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      marginBottom: Spacing.md,
      paddingLeft: Spacing.sm,
      paddingVertical: 4,
    },
    updateInlineInput: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      maxHeight: 80,
      paddingVertical: 6,
    },
    updateInlineBtn: {
      padding: 10,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.lg,
      paddingVertical: 14,
      gap: 8,
    },
    actionJoin: {
      backgroundColor: colors.primary,
    },
    actionLeave: {
      backgroundColor: colors.redPale,
      borderWidth: 1,
      borderColor: colors.red,
    },
    actionInvite: {
      backgroundColor: colors.purplePale,
      borderWidth: 1,
      borderColor: colors.purple,
    },
    actionInviteText: {
      color: colors.purple,
    },
    feedbackSection: {
      marginTop: Spacing.md,
      gap: Spacing.xs,
    },
    feedbackSummary: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.xs,
    },
    feedbackStat: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.primaryMid,
    },
    feedbackCard: {
      backgroundColor: colors.bg,
      borderRadius: Radius.sm,
      padding: Spacing.sm,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    feedbackHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    feedbackName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    feedbackRating: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.accent,
    },
    feedbackBody: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
    dangerZone: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      gap: 4,
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.red,
      borderRadius: Radius.md,
    },
    dangerBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    actionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
    },
    actionJoinText: {
      color: colors.textOnPrimary,
    },
    actionLeaveText: {
      color: colors.red,
    },
    closeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    closeBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });

  return { styles, ms };
}
