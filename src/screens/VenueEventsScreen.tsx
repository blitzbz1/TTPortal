import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Lucide } from '../components/Icon';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getUpcomingEventsByVenue } from '../services/events';
import { getVenueById } from '../services/venues';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import type { ThemeColors } from '../theme';

interface Props {
  venueId?: string;
}

type EventItem = {
  id: number;
  title?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  event_type?: string | null;
  max_participants?: number | null;
  recurrence_rule?: string | null;
  event_participants?: { user_id: string; profiles?: { full_name?: string | null } | null }[];
};

export function VenueEventsScreen({ venueId }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locale = lang === 'en' ? 'en-GB' : 'ro-RO';

  const [events, setEvents] = useState<EventItem[]>([]);
  const [venueName, setVenueName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!venueId || isNaN(Number(venueId))) return;
    const id = Number(venueId);
    const [evRes, vRes] = await Promise.all([
      getUpcomingEventsByVenue(id),
      getVenueById(id),
    ]);
    if (!evRes.error) setEvents((evRes.data ?? []) as unknown as EventItem[]);
    if (vRes.data) setVenueName((vRes.data as any).name ?? '');
  }, [venueId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const getBadge = (ev: EventItem) => {
    if (ev.status === 'confirmed') return { text: s('confirmed'), bg: colors.primaryPale, color: colors.primaryMid };
    if (ev.event_type === 'tournament') return { text: s('tournament'), bg: colors.bluePale, color: colors.blue };
    return { text: s('open'), bg: colors.amberPale, color: colors.accent };
  };

  const openEvent = (ev: EventItem) => {
    router.push({ pathname: '/(tabs)/events', params: { eventId: String(ev.id) } } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Lucide name="arrow-left" size={20} color={colors.text} />
          <Text style={styles.backText}>{s('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{s('eventsAtVenue')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        {venueName ? <Text style={styles.subtitle}>{venueName}</Text> : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : events.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={s('noEventsAtVenueTitle')}
            description={s('noEventsAtVenueDesc')}
            iconColor={colors.accentBright}
            iconBg={colors.amberPale}
          />
        ) : (
          events.map((ev, i) => {
            const badge = getBadge(ev);
            const participants = ev.event_participants ?? [];
            return (
              <Animated.View key={ev.id} entering={FadeInDown.delay(Math.min(i, 8) * 60).duration(300)}>
                <Card shadow="sm" borderRadius={14}>
                  <TouchableOpacity style={styles.eventCard} activeOpacity={0.7} onPress={() => openEvent(ev)}>
                    <View style={styles.eventTop}>
                      <View style={styles.eventDateWrap}>
                        <Lucide name="calendar" size={14} color={colors.accentBright} />
                        <Text style={styles.eventDate}>
                          {formatDate(ev.starts_at)} {'\u00B7'} {formatTime(ev.starts_at)}
                        </Text>
                        {ev.recurrence_rule && (
                          <Lucide name="repeat" size={13} color={colors.purple} />
                        )}
                      </View>
                      <View style={[styles.eventBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.eventBadgeText, { color: badge.color }]}>{badge.text}</Text>
                      </View>
                    </View>

                    {ev.title ? (
                      <View style={styles.eventMid}>
                        <Lucide name="tag" size={14} color={colors.textFaint} />
                        <Text style={styles.eventLocation}>{ev.title}</Text>
                      </View>
                    ) : null}

                    <View style={styles.eventBot}>
                      <View style={styles.spotsWrap}>
                        <Lucide name="users" size={14} color={colors.textFaint} />
                        <Text style={styles.spotsText}>
                          {participants.length}/{ev.max_participants ?? '\u221E'} {s('spots')}
                        </Text>
                      </View>
                      <Lucide name="chevron-right" size={16} color={colors.textFaint} />
                    </View>
                  </TouchableOpacity>
                </Card>
              </Animated.View>
            );
          })
        )}

        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    scroll: { flex: 1 },
    subtitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
      marginBottom: Spacing.xs,
    },
    loadingWrap: { paddingVertical: Spacing.xl, alignItems: 'center' },
    eventCard: { padding: Spacing.md, gap: Spacing.xs },
    eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    eventDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    eventDate: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    eventBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
    eventBadgeText: { fontFamily: Fonts.body, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
    eventMid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    eventLocation: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted, flex: 1 },
    eventBot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    spotsWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    spotsText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
  });
}
