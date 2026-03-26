import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Colors, Fonts } from '../theme';
import { useSession } from '../hooks/useSession';
import { getPlayHistory, getCheckinStats } from '../services/checkins';

const PAGE_SIZE = 20;

export function PlayHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total_checkins: number; unique_venues: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { user } = useSession();
  const router = useRouter();

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
  }, [user]);

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
        dayLabel = `Azi \u2014 ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
      } else if (dateStr === yesterday) {
        dayLabel = `Ieri \u2014 ${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`;
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
    if (!endedAt) return 'In curs';
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

  const grouped = groupByDay(history);

  const summaryStats = [
    { value: String(stats?.total_checkins ?? history.length), label: 'Check-ins', bg: Colors.greenPale, color: Colors.green },
    { value: String(stats?.unique_venues ?? 0), label: 'Locații', bg: Colors.purplePale, color: Colors.purple },
    { value: computeTotalTime(), label: 'Timp jucat', bg: Colors.amberPale, color: Colors.orange },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Istoric joc</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => Alert.alert('În curând', 'Această funcție va fi disponibilă în curând.')}>
          <Lucide name="calendar" size={14} color={Colors.inkMuted} />
          <Text style={styles.filterText}>
            {new Date().toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.green} style={{ flex: 1, marginTop: 40 }} />
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
            <Lucide name="flame" size={18} color={Colors.orangeBright} />
            <Text style={styles.streakText}>Istoric de joc</Text>
          </View>

          {/* Timeline */}
          {history.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 20, padding: 16 }}>
              <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint }}>
                Niciun check-in încă
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {grouped.map((day, dayIdx) => (
                <View key={day.dateKey}>
                  <View style={styles.dayLabel}>
                    <View style={[styles.dayDot, { backgroundColor: dayIdx === 0 ? Colors.green : Colors.inkFaint }]} />
                    <Text style={styles.dayText}>{day.dayLabel}</Text>
                  </View>
                  {day.entries.map((entry: any) => (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.entry}
                      onPress={() => router.push(`/venue/${entry.venue_id}` as any)}
                    >
                      <View style={[styles.entryIcon, { backgroundColor: Colors.greenPale }]}>
                        <Lucide name="map-pin" size={18} color={Colors.greenLight} />
                      </View>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryTitle}>
                          {entry.venues?.name ?? 'Locație'}
                        </Text>
                        <View style={styles.entryDetails}>
                          <Text style={styles.entryTime}>{formatTime(entry.started_at)}</Text>
                          <Text style={styles.entryDot}>{'\u00B7'}</Text>
                          <Text style={styles.entryDuration}>
                            {formatDuration(entry.started_at, entry.ended_at)}
                          </Text>
                        </View>
                      </View>
                      <Lucide name="chevron-right" size={18} color={Colors.inkFaint} />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {/* Load More */}
              {hasMore && (
                <View style={styles.loadMore}>
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={Colors.inkMuted} />
                    ) : (
                      <>
                        <Lucide name="chevrons-down" size={16} color={Colors.inkMuted} />
                        <Text style={styles.loadMoreText}>Mai vechi</Text>
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
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
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
    color: Colors.inkMuted,
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
    color: Colors.orange,
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
    color: Colors.inkMuted,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
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
    color: Colors.ink,
  },
  entryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryTime: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  entryDot: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  entryDuration: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  entryFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryFriendsText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.purpleMid,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadMoreText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.inkMuted,
  },
});
