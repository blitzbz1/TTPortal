import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, TextInput } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Lucide } from '../../components/Icon';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { cancelEvent, closeEvent, stopRecurrence, sendEventUpdate } from '../../services/events';
import { sendRequest } from '../../services/friends';
import { invalidateEventsCache } from '../../lib/eventsCache';
import type { DbChallenge, EventChallengeSubmission } from '../../features/challenges';
import { createStyles } from '../EventSchedulingScreen.styles';

type BadgeInfo = { text: string; bg: string; color: string };

function getInitials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#c026d3',
  '#db2777', '#dc2626', '#ea580c', '#d97706', '#4f46e5',
];

function getAvatarColor(id: string) {
  return AVATAR_COLORS[Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % AVATAR_COLORS.length];
}

function getDuration(start: string, end?: string) {
  if (!end) return null;
  const msVal = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.round(msVal / 3600000);
  return hours > 0 ? hours : null;
}

export interface EventDetailContentProps {
  event: any;
  user: { id: string } | null;
  friendIds: Set<string>;
  detailParticipants: any[];
  detailFeedback: any[];
  detailLoading: boolean;
  detailChallenges: EventChallengeSubmission[];
  feedbackGivenIds: Set<number>;
  challengeActionId: string | null;
  currentEventChallenge: DbChallenge | null;
  descExpanded: boolean;
  setDescExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  updateText: string;
  setUpdateText: React.Dispatch<React.SetStateAction<string>>;
  sendingUpdate: boolean;
  setSendingUpdate: React.Dispatch<React.SetStateAction<boolean>>;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  isEffectivelyOver: (event: any) => boolean;
  onAddChallenge: (challenge: DbChallenge) => void;
  onAwardChallenge: (submission: EventChallengeSubmission) => void;
  onJoin: (event: any) => void;
  challengeTitle: (challenge: any) => string;
  closeDetail: () => void;
  setFeedbackEventId: (id: number) => void;
  setLogHoursEvent: (v: { id: number; title: string; initialHours: number } | null) => void;
  setInviteModalVisible: (v: boolean) => void;
  fetchEvents: () => void | Promise<void>;
}

export function EventDetailContent(props: EventDetailContentProps) {
  const {
    event: ev, user, friendIds,
    detailParticipants, detailFeedback, detailLoading, detailChallenges, feedbackGivenIds,
    challengeActionId, currentEventChallenge,
    descExpanded, setDescExpanded,
    updateText, setUpdateText, sendingUpdate, setSendingUpdate,
    formatDate, formatTime, isEffectivelyOver,
    onAddChallenge, onAwardChallenge, onJoin, challengeTitle,
    closeDetail, setFeedbackEventId, setLogHoursEvent, setInviteModalVisible, fetchEvents,
  } = props;
  const { s, lang } = useI18n();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { styles, ms } = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const isPast = (e: any) =>
    e.status === 'completed' || e.status === 'cancelled' || isEffectivelyOver(e);

  const getBadgeInfo = (e: any): BadgeInfo => {
    if (e.status === 'completed' || (e.status !== 'cancelled' && isEffectivelyOver(e))) {
      return { text: s('completed'), bg: colors.borderLight, color: colors.textMuted };
    }
    if (e.status === 'cancelled') {
      return { text: s('cancelled'), bg: colors.cancelledBadgeBg, color: colors.red };
    }
    if (e.status === 'closed') {
      return { text: s('closed'), bg: colors.redPale, color: colors.red };
    }
    if (e.status === 'confirmed') {
      return { text: s('confirmed'), bg: colors.primaryPale, color: colors.primaryMid };
    }
    if (e.event_type === 'tournament') {
      return { text: s('tournament'), bg: colors.bluePale, color: colors.blue };
    }
    return { text: s('open'), bg: colors.primaryPale, color: colors.greenDeep };
  };

  const badge = getBadgeInfo(ev);
  const venueName = ev.venues?.name ?? s('unknownVenue');
  const venueCity = ev.venues?.city ?? '';
  const venueLat = ev.venues?.lat as number | null;
  const venueLng = ev.venues?.lng as number | null;
  const isJoined = ev.event_participants?.some((p: any) => p.user_id === user?.id);
  const duration = getDuration(ev.starts_at, ev.ends_at);
  const description = typeof ev.description === 'string' ? ev.description.trim() : '';
  const participantCount = detailParticipants.length || ev.event_participants?.length || 0;
  const participantLimit = ev.max_participants ?? '∞';
  const heroParticipants = detailParticipants.length > 0
    ? detailParticipants
    : (ev.event_participants ?? []);
  const userEventChallenge = detailChallenges.find((submission) => (
    submission.submitter_user_id === user?.id
    && ['pending', 'approved', 'auto_approved'].includes(submission.status)
  ));

  const handleParticipantPress = (participant: any) => {
    const participantId = participant.user_id;
    if (!participantId || !user?.id) return;
    const profile = participant.profiles;
    const fullName = profile?.full_name ?? s('player');
    const isMe = participantId === user.id;
    const isFriend = friendIds.has(participantId);

    if (isMe || isFriend) {
      router.push(`/(protected)/player/${participantId}` as any);
      return;
    }

    Alert.alert(
      fullName,
      s('addFriend'),
      [
        { text: s('cancel'), style: 'cancel' },
        {
          text: s('addFriend'),
          onPress: async () => {
            const { error } = await sendRequest(user.id, participantId);
            if (error) {
              Alert.alert(s('error'), error.message);
            } else {
              Alert.alert(s('friendRequestSent'));
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={ms.titleRow}>
        <Text style={ms.title} numberOfLines={2}>{ev.title || venueName}</Text>
        <View style={[styles.eventBadge, ms.titleBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.eventBadgeText, { color: badge.color }]}>{badge.text}</Text>
        </View>
      </View>

      {description ? (
        <View style={ms.heroDescription}>
          <Text style={ms.heroDescriptionText} numberOfLines={descExpanded ? undefined : 4}>
            {description}
          </Text>
          {description.length > 120 && !descExpanded && (
            <TouchableOpacity onPress={() => setDescExpanded(true)}>
              <Text style={ms.showMoreText}>...{lang === 'ro' ? 'mai mult' : 'more'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <View style={ms.heroParticipants}>
        <View style={ms.heroParticipantsHeader}>
          <View>
            <Text style={ms.heroParticipantsLabel}>{s('participants')}</Text>
            <Text style={ms.heroParticipantsValue}>{participantCount}/{participantLimit} {s('spots')}</Text>
          </View>
        </View>
        {detailLoading ? (
          <ActivityIndicator size="small" color={colors.accentBright} style={ms.heroParticipantsLoading} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.heroAvatarRail}>
            {heroParticipants.slice(0, 30).map((p: any, index: number) => {
              const profile = p.profiles;
              const fullName = profile?.full_name ?? s('player');
              const nameParts = fullName.split(' ').filter(Boolean);
              const shortName = p.user_id === user?.id
                ? s('you')
                : nameParts.length >= 2
                  ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                  : nameParts[0] ?? s('player');
              const isOrganizer = p.user_id === ev.organizer_id;
              const isFriend = friendIds.has(p.user_id) || p.user_id === user?.id;
              return (
                <TouchableOpacity
                  key={p.user_id ?? index}
                  style={ms.heroParticipantItem}
                  activeOpacity={0.78}
                  onPress={() => handleParticipantPress(p)}
                  accessibilityRole="button"
                  accessibilityLabel={isFriend ? fullName : `${s('addFriend')} ${fullName}`}
                >
                  <View
                    style={[
                      ms.heroAvatar,
                      isFriend && ms.heroAvatarFriend,
                      { backgroundColor: getAvatarColor(p.user_id ?? String(index)) },
                    ]}
                  >
                    <Text style={ms.heroAvatarText}>{getInitials(fullName)}</Text>
                    {isOrganizer && (
                      <View style={ms.pOrgBadge}>
                        <Lucide name="star" size={8} color={colors.amber} />
                      </View>
                    )}
                  </View>
                  <Text style={ms.heroParticipantName} numberOfLines={1}>{shortName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

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
            <Text style={ms.infoText}>{s('tableNumber')} {ev.table_number}</Text>
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

      {user && isJoined && ev.status !== 'cancelled' && (
        <View style={ms.section}>
          <View style={styles.challengeSectionHeader}>
            <View style={styles.challengeHeaderLeft}>
              <Text style={[ms.sectionTitle, styles.challengeHeaderTitle]}>{s('eventChallenges')}</Text>
              {detailChallenges.length > 0 && (
                <View style={styles.challengeCountPill}>
                  <Text style={styles.challengeCountPillText}>{detailChallenges.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.challengeAddPill,
                userEventChallenge && styles.disabledChallenge,
                currentEventChallenge && !userEventChallenge && challengeActionId === currentEventChallenge.id && styles.disabledChallenge,
              ]}
              disabled={!!userEventChallenge || !!challengeActionId}
              onPress={() => {
                if (currentEventChallenge) {
                  onAddChallenge(currentEventChallenge);
                } else {
                  router.push('/(tabs)/challenges?tab=challenges' as any);
                }
              }}
              accessibilityLabel={userEventChallenge
                ? s('eventChallengeAlreadyAdded')
                : currentEventChallenge
                  ? s('eventAddToEventShort')
                  : s('challengeSelect')}
            >
              <Lucide
                name={userEventChallenge ? 'check' : currentEventChallenge ? 'plus' : 'target'}
                size={15}
                color={colors.primary}
              />
              <Text style={styles.challengeAddPillText}>
                {userEventChallenge
                  ? s('eventChallengeAlreadyAdded')
                  : currentEventChallenge
                    ? (challengeActionId === currentEventChallenge.id ? s('loading') : s('eventAddToEventShort'))
                    : s('challengeSelect')}
              </Text>
            </TouchableOpacity>
          </View>
          {detailChallenges.length === 0 && (
            <Text style={styles.challengeSectionHint}>{s('eventChallengesDesc')}</Text>
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
                        onPress={() => onAwardChallenge(submission)}
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
            <TouchableOpacity
              style={[styles.challengeEmptyState, userEventChallenge && styles.disabledChallenge]}
              disabled={!!userEventChallenge || !!challengeActionId}
              onPress={() => {
                if (currentEventChallenge) {
                  onAddChallenge(currentEventChallenge);
                } else {
                  router.push('/(tabs)/challenges?tab=challenges' as any);
                }
              }}
              activeOpacity={0.85}
            >
              <View style={styles.challengeEmptyIcon}>
                <Lucide name={currentEventChallenge ? 'plus' : 'target'} size={20} color={colors.primary} />
              </View>
              <Text style={styles.challengeEmptyTitle}>{s('eventNoChallenges')}</Text>
              {!userEventChallenge && (
                <Text style={styles.challengeEmptyCta}>
                  {currentEventChallenge
                    ? (challengeActionId === currentEventChallenge.id ? s('loading') : s('eventAddToEventShort'))
                    : s('challengeSelect')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

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
                <Text style={ms.feedbackRating}>{fb.rating}{'\u2605'}</Text>
              </View>
              {fb.body ? <Text style={ms.feedbackBody}>{fb.body}</Text> : null}
            </View>
          ))}
        </View>
      )}

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
              const { error } = await sendEventUpdate(ev.id, updateText.trim());
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
        {(() => {
          if (!isPast(ev) || ev.status === 'cancelled') return null;
          const myRow = (ev.event_participants ?? []).find((p: any) => p.user_id === user?.id);
          const canInteract = !!myRow || ev.organizer_id === user?.id;
          if (!canInteract) return null;
          const loggedHours = Number(myRow?.hours_played ?? 0);
          const hasLoggedHours = loggedHours > 0;
          const hasGivenFeedback = feedbackGivenIds.has(ev.id);
          return (
            <>
              {!hasLoggedHours && (
                <TouchableOpacity
                  style={[ms.actionBtn, ms.actionJoin]}
                  onPress={() => { closeDetail(); setLogHoursEvent({ id: ev.id, title: ev.title ?? '', initialHours: loggedHours }); }}
                >
                  <Lucide name="clock" size={16} color={colors.textOnPrimary} />
                  <Text style={[ms.actionText, ms.actionJoinText]}>{s('logHours')}</Text>
                </TouchableOpacity>
              )}
              {ev.organizer_id !== user?.id && !hasGivenFeedback && (
                <TouchableOpacity
                  style={[ms.actionBtn, ms.actionJoin]}
                  onPress={() => { closeDetail(); setFeedbackEventId(ev.id); }}
                >
                  <Lucide name="message-square" size={16} color={colors.textOnPrimary} />
                  <Text style={[ms.actionText, ms.actionJoinText]}>{s('giveFeedback')}</Text>
                </TouchableOpacity>
              )}
            </>
          );
        })()}
        {!isPast(ev) && ev.status !== 'closed' && ev.organizer_id !== user?.id && (
          <TouchableOpacity
            style={[ms.actionBtn, isJoined ? ms.actionLeave : ms.actionJoin]}
            onPress={() => onJoin(ev)}
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
        {!isPast(ev) && ev.status !== 'closed' && ev.organizer_id === user?.id && (
          <TouchableOpacity
            style={[ms.actionBtn, ms.actionSecondary]}
            onPress={() => setInviteModalVisible(true)}
          >
            <Lucide name="send" size={16} color={colors.primary} />
            <Text style={[ms.actionText, ms.actionSecondaryText]}>
              {s('inviteToEvent')}
            </Text>
          </TouchableOpacity>
        )}
        {!isPast(ev) && ev.status !== 'closed' && ev.organizer_id === user?.id && (
          <TouchableOpacity
            style={[ms.actionBtn, ms.actionSecondary]}
            onPress={() => {
              Alert.alert(
                s('closeEvent'),
                s('closeEventConfirm'),
                [
                  { text: s('cancel'), style: 'cancel' },
                  {
                    text: s('closeEvent'),
                    onPress: async () => {
                      const { error } = await closeEvent(ev.id, user!.id);
                      if (error) {
                        Alert.alert(s('error'), error.message);
                      } else {
                        invalidateEventsCache(user!.id, ['upcoming', 'mine']);
                        await fetchEvents();
                      }
                    },
                  },
                ],
              );
            }}
          >
            <Lucide name="check-circle" size={16} color={colors.primary} />
            <Text style={[ms.actionText, ms.actionSecondaryText]}>{s('closeEvent')}</Text>
          </TouchableOpacity>
        )}
      </View>

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
                          invalidateEventsCache(user!.id, ['upcoming', 'mine']);
                          closeDetail();
                          fetchEvents();
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <Lucide name="repeat" size={14} color={colors.red} />
              <Text style={ms.dangerBtnText}>{s('stopRecurrence')}</Text>
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
                        invalidateEventsCache(user!.id, ['upcoming', 'mine']);
                        await fetchEvents();
                      }
                    },
                  },
                ],
              );
            }}
          >
            <Lucide name="x-circle" size={14} color={colors.red} />
            <Text style={ms.dangerBtnText}>{s('cancelEvent')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
