import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { getEvents, joinEvent, leaveEvent } from '../services/events';

type EventTab = 'upcoming' | 'past' | 'mine';

interface EventSchedulingScreenProps {
  hideTabBar?: boolean;
}

export function EventSchedulingScreen({ hideTabBar = false }: EventSchedulingScreenProps) {
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useSession();
  const router = useRouter();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await getEvents(
        activeTab,
        activeTab === 'mine' ? user?.id : undefined,
      );
      if (error) {
        Alert.alert('Eroare', 'Nu s-au putut încărca evenimentele.');
      } else {
        setEvents(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleJoin = useCallback(async (event: any) => {
    if (!user) return;
    const isJoined = event.event_participants?.some(
      (p: any) => p.user_id === user.id,
    );
    if (isJoined) {
      const { error } = await leaveEvent(event.id, user.id);
      if (error) {
        Alert.alert('Eroare', 'Nu s-a putut anula participarea.');
        return;
      }
    } else {
      const { error } = await joinEvent(event.id, user.id);
      if (error) {
        Alert.alert('Eroare', 'Nu s-a putut înregistra participarea.');
        return;
      }
    }
    fetchEvents();
  }, [user, fetchEvents]);

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
    if (event.status === 'confirmed') {
      return { text: 'Confirmat', bg: Colors.greenPale, color: Colors.greenMid };
    }
    if (event.type === 'tournament') {
      return { text: 'Turneu', bg: Colors.bluePale, color: Colors.blue };
    }
    return { text: 'Deschis', bg: Colors.amberPale, color: Colors.orange };
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evenimente</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/(protected)/create-event' as any)}
        >
          <Lucide name="plus" size={14} color={Colors.white} />
          <Text style={styles.createText}>Creează</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'upcoming' as EventTab, label: `Viitoare (${activeTab === 'upcoming' ? events.length : ''})`.replace('()', '') },
            { key: 'past' as EventTab, label: 'Trecute' },
            { key: 'mine' as EventTab, label: 'Ale mele' },
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
              Niciun eveniment găsit
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
              const venueName = event.venues?.name ?? 'Locație necunoscută';

              return (
                <View key={event.id} style={styles.eventCard}>
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
                        {participants.length}/{event.max_participants ?? '∞'} locuri
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinBtn, isJoined ? styles.joinedBtn : styles.notJoinedBtn]}
                      onPress={() => handleJoin(event)}
                    >
                      <Lucide
                        name={isJoined ? 'check' : 'user-plus'}
                        size={14}
                        color={isJoined ? Colors.white : Colors.green}
                      />
                      <Text style={[styles.joinText, isJoined ? styles.joinedText : styles.notJoinedText]}>
                        {isJoined ? 'Participi' : 'Participă'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {!hideTabBar && <TabBar activeTab="events" />}
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
    backgroundColor: Colors.white,
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ink,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.orangeBright,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  createText: {
    fontFamily: Fonts.body,
    fontSize: 13,
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
