import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getEvents, getEventParticipants, joinEvent, leaveEvent } from '../services/events';
import { getFriends } from '../services/friends';

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
  const { user } = useSession();
  const { s } = useI18n();
  const router = useRouter();

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

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Fetch friends list once
  useEffect(() => {
    if (!user?.id) return;
    getFriends(user.id).then(({ data }) => {
      if (!data) return;
      const ids = new Set<string>();
      for (const f of data) {
        const fid = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        ids.add(fid);
      }
      setFriendIds(ids);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBadgeInfo = (event: any) => {
    if (event.status === 'completed') {
      return { text: s('completed'), bg: Colors.borderLight, color: Colors.inkMuted };
    }
    if (event.status === 'cancelled') {
      return { text: s('cancelled'), bg: '#fde8e8', color: Colors.red };
    }
    if (event.status === 'confirmed') {
      return { text: s('confirmed'), bg: Colors.greenPale, color: Colors.greenMid };
    }
    if (event.event_type === 'tournament') {
      return { text: s('tournament'), bg: Colors.bluePale, color: Colors.blue };
    }
    return { text: s('open'), bg: Colors.amberPale, color: Colors.orange };
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getDuration = (start: string, end?: string) => {
    if (!end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.round(ms / 3600000);
    return hours > 0 ? hours : null;
  };

  const isPast = (event: any) =>
    event.status === 'completed' || event.status === 'cancelled';

  // Separate friend participants from others
  const friendParticipants = detailParticipants.filter(
    (p) => friendIds.has(p.user_id),
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('events')}</Text>
        <View style={styles.headerRight}>
          {user ? (
            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(protected)/create-event' as any)}>
              <Lucide name="plus" size={14} color={Colors.white} />
              <Text style={styles.createText}>{s('create')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/sign-in')}>
              <Lucide name="log-in" size={14} color={Colors.white} />
              <Text style={styles.createText}>{s('authLogin')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll}>
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
          <ActivityIndicator size="large" color={Colors.orangeBright} style={{ marginTop: 40 }} />
        ) : events.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40, padding: 16 }}>
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint }}>
              {s('noEvents')}
            </Text>
          </View>
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
                <TouchableOpacity key={event.id} style={styles.eventCard} activeOpacity={0.7} onPress={() => openDetail(event)}>
                  {/* Top */}
                  <View style={styles.eventTop}>
                    <View style={styles.eventDateWrap}>
                      <Lucide name="calendar" size={14} color={Colors.orangeBright} />
                      <Text style={styles.eventDate}>
                        {formatDate(event.starts_at)} {'\u00B7'} {formatTime(event.starts_at)}
                      </Text>
                    </View>
                    <View style={[styles.eventBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.eventBadgeText, { color: badge.color }]}>
                        {badge.text}
                      </Text>
                    </View>
                  </View>

                  {/* Location */}
                  <View style={styles.eventMid}>
                    <Lucide name="map-pin" size={14} color={Colors.inkFaint} />
                    <Text style={styles.eventLocation}>
                      {event.title ? `${venueName} — ${event.title}` : venueName}
                    </Text>
                  </View>

                  {/* Bottom */}
                  <View style={styles.eventBot}>
                    <View style={styles.avatarStack}>
                      {participants.slice(0, 3).map((p: any, i: number) => (
                        <View
                          key={p.user_id}
                          style={[
                            styles.stackAvatar,
                            { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i },
                          ]}
                        >
                          <Text style={styles.stackInitials}>
                            {getInitials(p.user_id?.slice(0, 2))}
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.attendeesText}>
                        {participants.length}/{event.max_participants ?? '∞'} {s('spots')}
                      </Text>
                    </View>
                    {!isPast(event) && (
                      <TouchableOpacity
                        style={[styles.joinBtn, isJoined ? styles.joinedBtn : styles.notJoinedBtn]}
                        onPress={(e) => { e.stopPropagation(); handleJoin(event); }}
                      >
                        <Lucide
                          name={isJoined ? 'check' : 'user-plus'}
                          size={14}
                          color={isJoined ? Colors.white : Colors.green}
                        />
                        <Text style={[styles.joinText, isJoined ? styles.joinedText : styles.notJoinedText]}>
                          {isJoined ? s('joined') : s('join')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {!hideTabBar && <TabBar activeTab="events" />}

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
                      <Lucide name="calendar" size={16} color={Colors.orangeBright} />
                      <Text style={ms.infoText}>
                        {formatDate(ev.starts_at)} {'\u00B7'} {formatTime(ev.starts_at)}
                        {ev.ends_at ? ` – ${formatTime(ev.ends_at)}` : ''}
                      </Text>
                    </View>

                    {duration != null && (
                      <View style={ms.infoRow}>
                        <Lucide name="clock" size={16} color={Colors.inkFaint} />
                        <Text style={ms.infoText}>
                          {s('duration')}: {duration} {s('hours')}
                        </Text>
                      </View>
                    )}

                    <View style={ms.infoRow}>
                      <Lucide name="map-pin" size={16} color={Colors.greenMid} />
                      <Text style={ms.infoText}>
                        {venueName}{venueCity ? `, ${venueCity}` : ''}
                      </Text>
                    </View>

                    {ev.table_number != null && (
                      <View style={ms.infoRow}>
                        <Lucide name="hash" size={16} color={Colors.inkFaint} />
                        <Text style={ms.infoText}>
                          {s('tableNumber')} {ev.table_number}
                        </Text>
                      </View>
                    )}

                    {ev.event_type === 'tournament' && (
                      <View style={ms.infoRow}>
                        <Lucide name="trophy" size={16} color={Colors.amber} />
                        <Text style={ms.infoText}>{s('tournament')}</Text>
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
                        {detailParticipants.length}/{ev.max_participants ?? '∞'}
                      </Text>
                    </View>

                    {detailLoading ? (
                      <ActivityIndicator size="small" color={Colors.orangeBright} style={{ marginVertical: 12 }} />
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
                      <Lucide name="users" size={16} color={Colors.purpleMid} />
                      <Text style={ms.friendsSummaryText}>
                        {friendParticipants.length} {s('friendsParticipating')}
                      </Text>
                    </View>
                  )}

                  {/* Join / Close buttons */}
                  <View style={ms.actions}>
                    {!isPast(ev) && (
                      <TouchableOpacity
                        style={[ms.actionBtn, isJoined ? ms.actionLeave : ms.actionJoin]}
                        onPress={() => handleJoin(ev)}
                      >
                        <Lucide
                          name={isJoined ? 'log-out' : 'user-plus'}
                          size={16}
                          color={isJoined ? Colors.red : Colors.white}
                        />
                        <Text style={[ms.actionText, isJoined ? ms.actionLeaveText : ms.actionJoinText]}>
                          {isJoined ? s('joined') : s('join')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={ms.closeBtn} onPress={closeDetail}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.green,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBtn: {
    padding: 4,
  },
  bellBtn: {
    position: 'relative',
    padding: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.red,
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
    fontWeight: '700',
    color: Colors.white,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.orangeBright,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 4,
  },
  createText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.orangeBright,
  },
  tabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  tabTextActive: {
    fontWeight: '600',
    color: Colors.orangeBright,
  },
  eventsList: {
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDate: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  eventBadge: {
    borderRadius: Radius.md,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  eventBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  eventMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventLocation: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMuted,
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
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  stackInitials: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  attendeesText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
    marginLeft: 8,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  joinedBtn: {
    backgroundColor: Colors.green,
  },
  notJoinedBtn: {
    borderWidth: 1.5,
    borderColor: Colors.green,
  },
  joinText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  joinedText: {
    color: Colors.white,
  },
  notJoinedText: {
    color: Colors.green,
  },
});

/* ===== Bottom Sheet (modal) styles ===== */
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.ink,
    flex: 1,
  },
  infoBlock: {
    gap: 10,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkMuted,
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
    marginBottom: 6,
  },
  countBadge: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.orangeBright,
    marginBottom: 6,
  },
  descText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkMuted,
    lineHeight: 20,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkFaint,
    fontStyle: 'italic',
  },
  participantList: {
    gap: 8,
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
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pAvatarFriend: {
    backgroundColor: Colors.purpleMid,
  },
  pInitials: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  pInfo: {
    flex: 1,
  },
  pName: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.ink,
  },
  pBadge: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  friendsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.purplePale,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 20,
  },
  friendsSummaryText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.purpleMid,
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
    backgroundColor: Colors.green,
  },
  actionLeave: {
    backgroundColor: Colors.redPale,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  actionText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  actionJoinText: {
    color: Colors.white,
  },
  actionLeaveText: {
    color: Colors.red,
  },
  closeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtnText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.inkMuted,
  },
});
