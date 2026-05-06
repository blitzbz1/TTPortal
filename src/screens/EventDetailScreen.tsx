import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import {
  getEventById,
  getEventParticipants,
  joinEvent,
  leaveEvent,
  sendEventInvites,
} from '../services/events';
import { getEventFeedback } from '../services/eventFeedback';
import { getFriendIds } from '../services/friends';
import { invalidateEventsCache } from '../lib/eventsCache';
import { hapticMedium } from '../lib/haptics';
import { ProductEvents, trackProductEvent } from '../lib/analytics';
import { FriendPickerModal } from '../components/FriendPickerModal';
import { LogHoursModal } from '../components/LogHoursModal';
import { WriteEventFeedbackScreen } from './WriteEventFeedbackScreen';
import { createStyles } from './EventSchedulingScreen.styles';
import { EventDetailContent } from './EventSchedulingScreen/EventDetailContent';
import { BADGE_TRACKS } from '../lib/badgeChallenges';
import {
  requiresOtherPlayer,
  resolveChallengeTitle,
  setCurrentSelectedChallenge,
  type ChallengeCategory,
  type DbChallenge,
  type EventChallengeSubmission,
  useChallengeChoices,
  useCurrentSelectedChallenge,
  useEventChallenges,
} from '../features/challenges';

export function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId: string }>();
  const eventId = Number(eventIdParam);
  const { user } = useSession();
  const { s, lang } = useI18n();
  const { colors, isDark } = useTheme();
  const { styles } = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const headerFg = isDark ? colors.text : colors.textOnPrimary;

  const [event, setEvent] = useState<any | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventNotFound, setEventNotFound] = useState(false);
  const [detailParticipants, setDetailParticipants] = useState<any[]>([]);
  const [detailFeedback, setDetailFeedback] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [feedbackGivenIds, setFeedbackGivenIds] = useState<Set<number>>(new Set());

  const [eventChallengeTrackId, setEventChallengeTrackId] = useState(BADGE_TRACKS[0].id);
  const [showAddChallenge, setShowAddChallenge] = useState(false);
  const [challengeActionId, setChallengeActionId] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [sendingUpdate, setSendingUpdate] = useState(false);

  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [feedbackEventId, setFeedbackEventId] = useState<number | null>(null);
  const [logHoursEvent, setLogHoursEvent] = useState<{ id: number; title: string; initialHours: number } | null>(null);

  const currentSelectedChallenge = useCurrentSelectedChallenge();
  const eventChallengeTrack = BADGE_TRACKS.find((b) => b.id === eventChallengeTrackId) ?? BADGE_TRACKS[0];
  const currentEventChallenge = currentSelectedChallenge && requiresOtherPlayer(currentSelectedChallenge)
    ? currentSelectedChallenge
    : null;
  const { choices: eventChallengeChoices } = useChallengeChoices(
    eventChallengeTrack.category as ChallengeCategory,
    {
      enabled: showAddChallenge && !!event && !currentEventChallenge,
      onlyOtherPlayer: true,
    },
  );
  const {
    addChallenge: addEventChallenge,
    awardChallenge: awardEventChallenge,
    challenges: detailChallenges,
  } = useEventChallenges(event?.id, user?.id);

  const isEffectivelyOver = useCallback((ev: any) => {
    if (ev.ends_at) return new Date(ev.ends_at) < new Date();
    const endOfDay = new Date(ev.starts_at);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay < new Date();
  }, []);

  const locale = lang === 'en' ? 'en-GB' : 'ro-RO';
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const challengeTitle = useCallback(
    (challenge: any) => resolveChallengeTitle(s, challenge as DbChallenge | EventChallengeSubmission),
    [s],
  );

  // Initial data fetch — event + participants + (if past) feedback.
  useEffect(() => {
    if (!Number.isFinite(eventId)) {
      setEventNotFound(true);
      setEventLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setEventLoading(true);
      const { data } = await getEventById(eventId);
      if (cancelled) return;
      if (!data) {
        setEventNotFound(true);
        setEventLoading(false);
        return;
      }
      setEvent(data);
      setEventLoading(false);
      trackProductEvent(ProductEvents.eventOpened, {
        eventId: (data as any).id,
        eventType: (data as any).event_type,
      });

      setDetailLoading(true);
      const past = isEffectivelyOver(data) || (data as any).status === 'completed' || (data as any).status === 'cancelled';
      const [partRes, fbRes] = await Promise.all([
        getEventParticipants(eventId),
        past && (data as any).status !== 'cancelled'
          ? getEventFeedback(eventId)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setDetailParticipants(partRes.data ?? []);
      setDetailFeedback(fbRes.data ?? []);
      setDetailLoading(false);
    })();
    return () => { cancelled = true; };
  }, [eventId, isEffectivelyOver]);

  // Friends list — used to flag friend participants in the participant strip.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getFriendIds(user.id).then((ids) => {
      if (!cancelled) setFriendIds(new Set(ids));
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleAddChallengeToEvent = useCallback(async (challenge: DbChallenge) => {
    if (!user || !event) return;
    setChallengeActionId(challenge.id);
    const { error } = await addEventChallenge(challenge);
    setChallengeActionId(null);
    if (error) {
      Alert.alert(s('error'), error.message);
      return;
    }
    trackProductEvent(ProductEvents.eventChallengeAttached, {
      eventId: event.id,
      challengeId: challenge.id,
      category: challenge.category,
    });
    if (currentEventChallenge?.id === challenge.id) {
      setCurrentSelectedChallenge(null);
    }
    setShowAddChallenge(false);
  }, [addEventChallenge, currentEventChallenge?.id, s, event, user]);

  const handleAwardEventChallenge = useCallback(async (submission: EventChallengeSubmission) => {
    if (!event) return;
    setChallengeActionId(submission.submission_id);
    const { error } = await awardEventChallenge(submission.submission_id);
    setChallengeActionId(null);
    if (error) {
      Alert.alert(s('error'), error.message);
      return;
    }
    trackProductEvent(ProductEvents.eventChallengeAwarded, {
      eventId: event.id,
      submissionId: submission.submission_id,
      category: submission.category,
    });
  }, [awardEventChallenge, s, event]);

  const handleJoin = useCallback(async (ev: any) => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    const isJoined = ev.event_participants?.some((p: any) => p.user_id === user.id);
    if (isJoined) {
      const { error } = await leaveEvent(ev.id, user.id);
      if (error) {
        Alert.alert(s('error'), s('leaveError'));
        return;
      }
    } else {
      const { error } = await joinEvent(ev.id, user.id);
      if (error) {
        Alert.alert(s('error'), s('joinError'));
        return;
      }
    }
    hapticMedium();
    trackProductEvent(ProductEvents.eventJoined, {
      eventId: ev.id,
      action: isJoined ? 'leave' : 'join',
    });
    invalidateEventsCache(user.id, ['upcoming', 'mine']);
    // Refresh local state: participants and the underlying event row.
    const [{ data: partData }, { data: refreshed }] = await Promise.all([
      getEventParticipants(ev.id),
      getEventById(ev.id),
    ]);
    if (partData) setDetailParticipants(partData);
    if (refreshed) setEvent(refreshed);
  }, [user, router, s]);

  // After cancel/close, EventDetailContent calls fetchEvents(); on this
  // screen that translates to popping back, since the list reloads on focus.
  const fetchEvents = useCallback(() => {
    router.back();
  }, [router]);

  if (eventLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
            <Lucide name="chevron-left" size={26} color={headerFg} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{s('eventDetails')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.detailLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (eventNotFound || !event) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
            <Lucide name="chevron-left" size={26} color={headerFg} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{s('eventDetails')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.detailLoading}>
          <Text style={{ color: colors.textMuted }}>{s('eventNotFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
          <Lucide name="chevron-left" size={26} color={headerFg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {s('eventDetails')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.detailContent, { paddingBottom: insets.bottom + 16 }]}
        keyboardDismissMode="on-drag"
      >
        <EventDetailContent
          event={event}
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
          closeDetail={() => router.back()}
          setFeedbackEventId={setFeedbackEventId}
          setLogHoursEvent={setLogHoursEvent}
          setInviteModalVisible={setInviteModalVisible}
          fetchEvents={fetchEvents}
        />
      </ScrollView>

      {user && (
        <FriendPickerModal
          visible={inviteModalVisible}
          userId={user.id}
          onConfirm={async (ids) => {
            setInviteModalVisible(false);
            if (ids.length > 0) await sendEventInvites(event.id, ids);
          }}
          onClose={() => setInviteModalVisible(false)}
        />
      )}

      <WriteEventFeedbackScreen
        visible={feedbackEventId !== null}
        eventId={feedbackEventId}
        onDismiss={() => {
          if (feedbackEventId) setFeedbackGivenIds((prev) => new Set(prev).add(feedbackEventId));
          setFeedbackEventId(null);
        }}
      />

      <LogHoursModal
        visible={logHoursEvent !== null}
        eventId={logHoursEvent?.id ?? null}
        eventTitle={logHoursEvent?.title}
        initialHours={logHoursEvent?.initialHours}
        onDismiss={() => setLogHoursEvent(null)}
      />
    </View>
  );
}
