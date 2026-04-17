import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Lucide } from '../../components/Icon';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../hooks/useI18n';
import { cancelEvent, stopRecurrence, sendEventUpdate } from '../../services/events';
import { BADGE_TRACKS } from '../../lib/badgeChallenges';
import type { DbChallenge, EventChallengeSubmission } from '../../features/challenges';
import { createStyles } from '../EventSchedulingScreen.styles';

const TRACK_ROWS = [
  [BADGE_TRACKS[0], BADGE_TRACKS[1], BADGE_TRACKS[2]],
  [BADGE_TRACKS[3], BADGE_TRACKS[4], BADGE_TRACKS[5]],
] as const;

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
  showAddChallenge: boolean;
  setShowAddChallenge: React.Dispatch<React.SetStateAction<boolean>>;
  eventChallengeTrack: (typeof BADGE_TRACKS)[number];
  setEventChallengeTrackId: React.Dispatch<React.SetStateAction<string>>;
  challengeActionId: string | null;
  eventChallengeChoices: DbChallenge[];
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
  setInviteModalVisible: (v: boolean) => void;
  fetchEvents: () => void;
}

export function EventDetailContent(props: EventDetailContentProps) {
  const {
    event: ev, user, friendIds,
    detailParticipants, detailFeedback, detailLoading, detailChallenges, feedbackGivenIds,
    showAddChallenge, setShowAddChallenge,
    eventChallengeTrack, setEventChallengeTrackId,
    challengeActionId, eventChallengeChoices, currentEventChallenge,
    descExpanded, setDescExpanded,
    updateText, setUpdateText, sendingUpdate, setSendingUpdate,
    formatDate, formatTime, isEffectivelyOver,
    onAddChallenge, onAwardChallenge, onJoin, challengeTitle,
    closeDetail, setFeedbackEventId, setInviteModalVisible, fetchEvents,
  } = props;
  const { s, lang } = useI18n();
  const { colors, isDark } = useTheme();
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
    if (e.status === 'confirmed') {
      return { text: s('confirmed'), bg: colors.primaryPale, color: colors.primaryMid };
    }
    if (e.event_type === 'tournament') {
      return { text: s('tournament'), bg: colors.bluePale, color: colors.blue };
    }
    return { text: s('open'), bg: colors.amberPale, color: colors.accent };
  };

  const badge = getBadgeInfo(ev);
  const venueName = ev.venues?.name ?? s('unknownVenue');
  const venueCity = ev.venues?.city ?? '';
  const venueLat = ev.venues?.lat as number | null;
  const venueLng = ev.venues?.lng as number | null;
  const isJoined = ev.event_participants?.some((p: any) => p.user_id === user?.id);
  const duration = getDuration(ev.starts_at, ev.ends_at);
  const friendParticipants = detailParticipants.filter((p) => friendIds.has(p.user_id));
  const userEventChallenge = detailChallenges.find((submission) => (
    submission.submitter_user_id === user?.id
    && ['pending', 'approved', 'auto_approved'].includes(submission.status)
  ));

  return (
    <>
      <View style={ms.titleRow}>
        <Text style={ms.title} numberOfLines={2}>{ev.title || venueName}</Text>
        <View style={[styles.eventBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.eventBadgeText, { color: badge.color }]}>{badge.text}</Text>
        </View>
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

      <View style={ms.section}>
        <Text style={ms.sectionTitle}>{s('description')}</Text>
        <Text style={ms.descText} numberOfLines={descExpanded ? undefined : 4}>
          {ev.description || s('noDescription')}
        </Text>
        {ev.description && ev.description.length > 120 && !descExpanded && (
          <TouchableOpacity onPress={() => setDescExpanded(true)}>
            <Text style={ms.showMoreText}>...{lang === 'ro' ? 'mai mult' : 'more'}</Text>
          </TouchableOpacity>
        )}
      </View>

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
              {currentEventChallenge ? (
                <View style={styles.eventChallengeCurrentWrap}>
                  <View style={styles.eventChallengePickerIntro}>
                    <View style={styles.eventChallengeIntroIcon}>
                      <Lucide name="target" size={15} color={colors.primary} />
                    </View>
                    <View style={styles.eventChallengeIntroCopy}>
                      <Text style={styles.eventChallengeIntroTitle}>{s('eventCurrentChallengeFromTab')}</Text>
                      <Text style={styles.eventChallengeIntroText}>{s('eventCurrentChallengeFromTabDesc')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.eventChallengeChoice,
                      styles.eventChallengeChoiceFeatured,
                      challengeActionId === currentEventChallenge.id && styles.disabledChallenge,
                    ]}
                    disabled={!!challengeActionId}
                    onPress={() => onAddChallenge(currentEventChallenge)}
                  >
                    <View style={styles.eventChallengeChoiceTop}>
                      <Text style={styles.eventChallengeChoiceTitle}>{challengeTitle(currentEventChallenge)}</Text>
                      <View style={styles.eventChallengeChoiceBadge}>
                        <Text style={styles.eventChallengeChoiceBadgeText}>
                          {s('challengeVerificationOther')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.eventChallengeChoiceCta}>
                      {challengeActionId === currentEventChallenge.id ? s('loading') : s('eventAttachChallenge')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.eventChallengePickerIntro}>
                    <View style={styles.eventChallengeIntroIcon}>
                      <Lucide name="sparkles" size={15} color={colors.primary} />
                    </View>
                    <View style={styles.eventChallengeIntroCopy}>
                      <Text style={styles.eventChallengeIntroTitle}>{s('eventChooseChallengeTrack')}</Text>
                      <Text style={styles.eventChallengeIntroText}>{s('eventChooseChallengeTrackDesc')}</Text>
                    </View>
                  </View>
                  <View style={styles.eventChallengeTrackGrid}>
                    {TRACK_ROWS.map((row, rowIndex) => (
                      <View key={rowIndex} style={styles.eventChallengeTrackRow}>
                        {row.map((track) => {
                          const active = track.id === eventChallengeTrack.id;
                          return (
                            <TouchableOpacity
                              key={track.id}
                              style={[
                                styles.eventChallengeTrack,
                                { borderColor: active ? track.color : track.paleColor, backgroundColor: active ? track.paleColor : colors.bg },
                              ]}
                              onPress={() => setEventChallengeTrackId(track.id)}
                            >
                              <View style={[styles.eventChallengeTrackIcon, { backgroundColor: track.paleColor }]}>
                                <Lucide name={track.icon} size={13} color={track.color} />
                              </View>
                              <Text
                                style={[styles.eventChallengeTrackText, { color: active ? track.color : colors.text }]}
                                adjustsFontSizeToFit
                                minimumFontScale={0.82}
                              >
                                {s(`badgeTrack_${track.id}_short`)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </View>

                  {eventChallengeChoices.length > 0 ? (
                    <View style={styles.eventChallengeChoiceList}>
                      {eventChallengeChoices.map((challenge) => (
                        <TouchableOpacity
                          key={challenge.id}
                          style={[styles.eventChallengeChoice, challengeActionId === challenge.id && styles.disabledChallenge]}
                          disabled={!!challengeActionId}
                          onPress={() => onAddChallenge(challenge)}
                        >
                          <View style={styles.eventChallengeChoiceTop}>
                            <Text style={styles.eventChallengeChoiceTitle}>{challengeTitle(challenge)}</Text>
                            <View style={styles.eventChallengeChoiceBadge}>
                              <Text style={styles.eventChallengeChoiceBadgeText}>
                                {s('challengeVerificationOther')}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.eventChallengeChoiceCta}>
                            {challengeActionId === challenge.id ? s('loading') : s('eventAttachChallenge')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={ms.emptyText}>{s('eventNoOtherChallenges')}</Text>
                  )}
                </>
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
            <Text style={ms.emptyText}>{s('eventNoChallenges')}</Text>
          )}
        </View>
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
                <Text style={ms.feedbackRating}>{fb.rating}{'\u2605'} · {Number(fb.hours_played)}h</Text>
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
}
