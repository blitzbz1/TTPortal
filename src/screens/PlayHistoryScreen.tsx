import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getPlayHistory, getCheckinStats } from '../services/checkins';

const PAGE_SIZE = 20;

export function PlayHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total_checkins: number; unique_venues: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterMonth, setFilterMonth] = useState(false);
  const { user } = useSession();
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [historyRes, statsRes] = await Promise.all([
        getPlayHistory(user.id, PAGE_SIZE, 0),
        getCheckinStats(user.id),
      ]);
      if (historyRes.data) {
        setHistory(historyRes.data);
        setOffset(historyRes.data.length);
        setHasMore(historyRes.data.length >= PAGE_SIZE);
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data } = await getPlayHistory(user.id, PAGE_SIZE, offset);
      if (data && data.length > 0) {
        setHistory((prev) => [...prev, ...data]);
        setOffset((prev) => prev + data.length);
        setHasMore(data.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [user, offset, loadingMore, hasMore]);

  // Group history entries by day
  const groupByDay = (entries: any[]) => {
    const groups: { dayLabel: string; dateKey: string; entries: any[] }[] = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const entry of entries) {
      const date = new Date(entry.started_at);
      const dateStr = date.toDateString();
      let dayLabel: string;

      if (dateStr === today) {
        dayLabel = `${s('today')} \u2014 ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
      } else if (dateStr === yesterday) {
        dayLabel = `${s('yesterday')} \u2014 ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
      } else {
        dayLabel = date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
      }

      const existing = groups.find((g) => g.dateKey === dateStr);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.push({ dayLabel, dateKey: dateStr, entries: [entry] });
      }
    }
    return groups;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: string, endedAt?: string | null) => {
    if (!endedAt) return s('inProgress');
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const computeTotalTime = () => {
    let totalMs = 0;
    for (const entry of history) {
      if (entry.ended_at) {
        totalMs += new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
      }
    }
    const hours = Math.round(totalMs / 3600000);
    return `${hours}h`;
  };

  const displayHistory = useMemo(() => {
    if (!filterMonth) return history;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return history.filter((entry) => {
      const d = new Date(entry.started_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [history, filterMonth]);

  const grouped = groupByDay(displayHistory);

  const summaryStats = [
    { value: String(stats?.total_checkins ?? history.length), label: s('checkins'), bg: colors.primaryPale, color: colors.primary },
    { value: String(stats?.unique_venues ?? 0), label: s('locations'), bg: colors.purplePale, color: colors.purple },
    { value: computeTotalTime(), label: s('timePlayed'), bg: colors.amberPale, color: colors.accent },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('playHistoryTitle')}</Text>
        <TouchableOpacity
          style={[styles.filterBtn, filterMonth && { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim }]}
          onPress={() => setFilterMonth((v) => !v)}
        >
          <Lucide name="calendar" size={14} color={filterMonth ? colors.primary : colors.textMuted} />
          <Text style={[styles.filterText, filterMonth && { color: colors.primary, fontWeight: '600' }]}>
            {filterMonth
              ? new Date().toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })
              : s('allTime') || 'Tot'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll}>
          {/* Stats Summary */}
          <View style={styles.statsRow}>
            {summaryStats.map((stat) => (
              <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg }]}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Streak Bar */}
          <View style={styles.streakBar}>
            <Lucide name="flame" size={18} color={colors.accentBright} />
            <Text style={styles.streakText}>{s('playHistoryLabel')}</Text>
          </View>

          {/* Timeline */}
          {displayHistory.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 20, padding: 16 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textFaint }}>
                {s('noCheckins')}
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {grouped.map((day, dayIdx) => (
                <View key={day.dateKey}>
                  <View style={styles.dayLabel}>
                    <View style={[styles.dayDot, { backgroundColor: dayIdx === 0 ? colors.primary : colors.textFaint }]} />
                    <Text style={styles.dayText}>{day.dayLabel}</Text>
                  </View>
                  {day.entries.map((entry: any) => (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.entry}
                      onPress={() => router.push(`/venue/${entry.venue_id}` as any)}
                    >
                      <View style={[styles.entryIcon, { backgroundColor: colors.primaryPale }]}>
                        <Lucide name="map-pin" size={18} color={colors.primaryLight} />
                      </View>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryTitle}>
                          {entry.venues?.name ?? s('venue')}
                        </Text>
                        <View style={styles.entryDetails}>
                          <Text style={styles.entryTime}>{formatTime(entry.started_at)}</Text>
                          <Text style={styles.entryDot}>{'\u00B7'}</Text>
                          <Text style={styles.entryDuration}>
                            {formatDuration(entry.started_at, entry.ended_at)}
                          </Text>
                        </View>
                      </View>
                      <Lucide name="chevron-right" size={18} color={colors.textFaint} />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {/* Load More */}
              {hasMore && (
                <View style={styles.loadMore}>
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    ) : (
                      <>
                        <Lucide name="chevrons-down" size={16} color={colors.textMuted} />
                        <Text style={styles.loadMoreText}>{s('loadOlder')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgMuted,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 10,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
    },
    scroll: {
      flex: 1,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 16,
      paddingBottom: 8,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 12,
      padding: 12,
      gap: 4,
      ...Shadows.sm,
    },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: 24,
      fontWeight: '800',
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
    streakBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    streakText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    timeline: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    dayLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 8,
    },
    dayDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dayText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
    },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingLeft: 16,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      borderLeftWidth: 2,
      borderLeftColor: colors.borderLight,
      ...Shadows.sm,
    },
    entryIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryInfo: {
      flex: 1,
      gap: 2,
    },
    entryTitle: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    entryDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    entryTime: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textFaint,
    },
    entryDot: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textFaint,
    },
    entryDuration: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textFaint,
    },
    entryFriends: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    entryFriendsText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.purpleMid,
    },
    loadMore: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    loadMoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgMuted,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 20,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.md,
    },
    loadMoreText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
    },
  });
}
