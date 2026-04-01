import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Card } from '../components/Card';
import { EventCardSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useNotifications } from '../hooks/useNotifications';
import { getEvents, getEventParticipants, joinEvent, leaveEvent, cancelEvent, stopRecurrence, sendEventInvites, sendEventUpdate } from '../services/events';
import { getFriendIds } from '../services/friends';
import { FriendPickerModal } from '../components/FriendPickerModal';
import { hapticMedium } from '../lib/haptics';

type EventTab = 'upcoming' | 'past' | 'mine';

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
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [detailLoading, setDetailLoading] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const { s, lang } = useI18n();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const { colors } = useTheme();
  const { styles, ms } = useMemo(() => createStyles(colors), [colors]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await getEvents(
        activeTab,
        (activeTab === 'mine' || activeTab === 'past') ? user?.id : undefined,
      );
      if (error) {
        Alert.alert(s('error'), s('eventsLoadError'));
      } else {
        setEvents(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

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

  const openDetail = useCallback(async (event: any) => {
    setSelectedEvent(event);
    setDetailLoading(true);
    const { data } = await getEventParticipants(event.id);
    setDetailParticipants(data ?? []);
    setDetailLoading(false);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedEvent(null);
    setDetailParticipants([]);
    setUpdateText('');
  }, []);

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
        <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/(protected)/notifications' as any)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Lucide name="bell" size={18} color={colors.textOnPrimary} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'upcoming' as EventTab, label: `${s('upcoming')} (${activeTab === 'upcoming' ? events.length : ''})`.replace('()', '').trim() },
            { key: 'past' as EventTab, label: s('past') },
            ...(user ? [{ key: 'mine' as EventTab, label: s('mine') }] : []),
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

        {/* Event Cards */}
        {loading ? (
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
            {events.map((event) => {
              const badge = getBadgeInfo(event);
              const isJoined = event.event_participants?.some(
                (p: any) => p.user_id === user?.id,
              );
              const participants = event.event_participants ?? [];
              const venueName = event.venues?.name ?? s('unknownVenue');

              return (
                <Card key={event.id} shadow="sm" borderRadius={14}>
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
                              { marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i },
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
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </View>
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

      {/* ===== Event Detail Bottom Sheet ===== */}
      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <Pressable style={ms.overlay} onPress={closeDetail}>
          <Pressable style={[ms.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            {selectedEvent && (() => {
              const ev = selectedEvent;
              const badge = getBadgeInfo(ev);
              const venueName = ev.venues?.name ?? s('unknownVenue');
              const venueCity = ev.venues?.city ?? '';
              const isJoined = ev.event_participants?.some((p: any) => p.user_id === user?.id);
              const duration = getDuration(ev.starts_at, ev.ends_at);

              return (
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                  {/* Handle bar */}
                  <View style={ms.handleWrap}>
                    <View style={ms.handle} />
                  </View>

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
                      <Text style={ms.infoText}>
                        {formatDate(ev.starts_at)} {'\u00B7'} {formatTime(ev.starts_at)}
                        {ev.ends_at ? ` – ${formatTime(ev.ends_at)}` : ''}
                      </Text>
                    </View>

                    {duration != null && (
                      <View style={ms.infoRow}>
                        <Lucide name="clock" size={16} color={colors.textFaint} />
                        <Text style={ms.infoText}>
                          {s('duration')}: {duration} {s('hours')}
                        </Text>
                      </View>
                    )}

                    <View style={ms.infoRow}>
                      <Lucide name="map-pin" size={16} color={colors.primaryMid} />
                      <Text style={ms.infoText}>
                        {venueName}{venueCity ? `, ${venueCity}` : ''}
                      </Text>
                    </View>

                    {ev.table_number != null && (
                      <View style={ms.infoRow}>
                        <Lucide name="hash" size={16} color={colors.textFaint} />
                        <Text style={ms.infoText}>
                          {s('tableNumber')} {ev.table_number}
                        </Text>
                      </View>
                    )}

                    {ev.event_type === 'tournament' && (
                      <View style={ms.infoRow}>
                        <Lucide name="trophy" size={16} color={colors.amber} />
                        <Text style={ms.infoText}>{s('tournament')}</Text>
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
                    <Text style={ms.descText}>
                      {ev.description || s('noDescription')}
                    </Text>
                  </View>

                  {/* Participants */}
                  <View style={ms.section}>
                    <View style={ms.sectionHeader}>
                      <Text style={ms.sectionTitle}>{s('participants')}</Text>
                      <Text style={ms.countBadge}>
                        {detailParticipants.length}/{ev.max_participants ?? '\u221E'}
                      </Text>
                    </View>

                    {detailLoading ? (
                      <ActivityIndicator size="small" color={colors.accentBright} style={{ marginVertical: 12 }} />
                    ) : detailParticipants.length === 0 ? (
                      <Text style={ms.emptyText}>{s('noEvents')}</Text>
                    ) : (
                      <View style={ms.participantList}>
                        {detailParticipants.map((p) => {
                          const profile = p.profiles;
                          const name = profile?.full_name ?? '??';
                          const isFriend = friendIds.has(p.user_id);
                          const isOrganizer = p.user_id === ev.organizer_id;
                          const isMe = p.user_id === user?.id;
                          return (
                            <View key={p.user_id} style={ms.pRow}>
                              <View style={[ms.pAvatar, isFriend && ms.pAvatarFriend]}>
                                <Text style={ms.pInitials}>{getInitials(name)}</Text>
                              </View>
                              <View style={ms.pInfo}>
                                <Text style={ms.pName}>
                                  {name}
                                  {isMe ? ` (${s('you')})` : ''}
                                </Text>
                                {(isOrganizer || isFriend) && (
                                  <Text style={ms.pBadge}>
                                    {isOrganizer ? s('organizer') : ''}
                                    {isOrganizer && isFriend ? ' · ' : ''}
                                    {isFriend ? '👋' : ''}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Friends summary */}
                  {friendParticipants.length > 0 && (
                    <View style={ms.friendsSummary}>
                      <Lucide name="users" size={16} color={colors.purpleMid} />
                      <Text style={ms.friendsSummaryText}>
                        {friendParticipants.length} {s('friendsParticipating')}
                      </Text>
                    </View>
                  )}

                  {/* Organizer: send update to participants */}
                  {ev.organizer_id === user?.id && detailParticipants.length > 0 && (
                    <View style={ms.updateSection}>
                      <Text style={ms.sectionTitle}>{s('sendUpdate')}</Text>
                      <TextInput
                        style={ms.updateInput}
                        placeholder={s('updatePlaceholder')}
                        placeholderTextColor={colors.textFaint}
                        value={updateText}
                        onChangeText={setUpdateText}
                        multiline
                        numberOfLines={2}
                      />
                      <TouchableOpacity
                        style={[ms.updateBtn, (sendingUpdate || !updateText.trim()) && { opacity: 0.4 }]}
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
                        <Lucide name="megaphone" size={16} color={colors.textOnPrimary} />
                        <Text style={ms.updateBtnText}>
                          {sendingUpdate ? s('loading') : s('sendUpdate')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Join / Invite buttons */}
                  <View style={ms.actions}>
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
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

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
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      minHeight: 52,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    bellBtn: {
      position: 'relative',
      padding: Spacing.xxs,
    },
    bellBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: colors.red,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    bellBadgeText: {
      fontFamily: Fonts.body,
      fontSize: 9,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
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
    friendsSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.purplePale,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    friendsSummaryText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.purpleMid,
    },
    updateSection: {
      marginBottom: Spacing.md,
      gap: 10,
    },
    updateInput: {
      backgroundColor: colors.bgMuted,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.text,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    updateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      borderRadius: Radius.lg,
      paddingVertical: 12,
      gap: 8,
    },
    updateBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
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
      borderRadius: Radius.lg,
      paddingVertical: 14,
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
