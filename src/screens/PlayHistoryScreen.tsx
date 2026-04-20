import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Easings } from '../lib/motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { createStyles } from './PlayHistoryScreen.styles';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getPlayHistory } from '../services/checkins';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 20;

function AnimatedCounter({ value, style }: { value: string; style: any }) {
  // Parse the numeric part (e.g. "2.5h" → 2.5, "0" → 0)
  const numeric = parseFloat(value) || 0;
  const suffix = value.replace(/[\d.]/g, '');
  const isDecimal = value.includes('.');

  const [display, setDisplay] = useState(value);
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = 0;
    sv.value = withTiming(numeric, { duration: 600, easing: Easings.decelerate });
  }, [numeric, sv]);

  useAnimatedReaction(
    () => sv.value,
    (current) => {
      const formatted = isDecimal ? current.toFixed(1) : Math.round(current).toString();
      runOnJS(setDisplay)(formatted + suffix);
    },
    [sv, suffix, isDecimal],
  );

  return <Text style={style}>{display}</Text>;
}

export function PlayHistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('week');
  const [eventHours, setEventHours] = useState<{ hours_played: number; starts_at: string; venue_id: number | null }[]>([]);
  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(new Date().toDateString());
  const [allCheckins, setAllCheckins] = useState<{ venue_id: number; venue_name: string; started_at: string; ended_at: string | null }[]>([]);
  const [eventVenues, setEventVenues] = useState<{ venue_id: number; venue_name: string; event_title: string; starts_at: string; hours_played: number | null }[]>([]);
  const { user } = useSession();
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [historyRes, allCheckinsRes, eventParticipationsRes] = await Promise.all([
        getPlayHistory(user.id, PAGE_SIZE, 0),
        supabase.from('checkins').select('venue_id, started_at, ended_at, venues(name)').eq('user_id', user.id),
        supabase.from('event_participants').select('event_id, hours_played, events(venue_id, starts_at, title, venues(name))').eq('user_id', user.id),
      ]);
      setAllCheckins((allCheckinsRes.data ?? []).map((c: any) => ({ venue_id: c.venue_id, venue_name: c.venues?.name ?? '', started_at: c.started_at, ended_at: c.ended_at })));

      const participants = eventParticipationsRes.data ?? [];
      setEventHours(participants
        .map((ep: any) => ({
          hours_played: Number(ep.hours_played ?? 0),
          starts_at: ep.events?.starts_at,
          venue_id: ep.events?.venue_id ?? null,
        }))
        .filter((r: any) => r.starts_at && r.hours_played > 0));
      setEventVenues(participants.map((ep: any) => ({
        venue_id: ep.events?.venue_id,
        venue_name: ep.events?.venues?.name ?? ep.events?.title ?? '',
        event_title: ep.events?.title ?? '',
        starts_at: ep.events?.starts_at,
        hours_played: Number(ep.hours_played ?? 0) > 0 ? Number(ep.hours_played) : null,
      })).filter((v: any) => v.venue_id));
      if (historyRes.data) {
        setHistory(historyRes.data);
        setOffset(historyRes.data.length);
        setHasMore(historyRes.data.length >= PAGE_SIZE);
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

  const getPeriodStart = useCallback(() => {
    const now = new Date();
    if (period === 'week') {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = start of week
      const start = new Date(now);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (period === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (period === 'year') {
      return new Date(now.getFullYear(), 0, 1);
    }
    return new Date(2000, 0, 1); // all time
  }, [period]);

  const displayHistory = useMemo(() => {
    const start = getPeriodStart();
    return history.filter((entry) => new Date(entry.started_at) >= start);
  }, [history, getPeriodStart]);

  const filteredCheckins = useMemo(() => {
    const start = getPeriodStart();
    return allCheckins.filter((c) => new Date(c.started_at) >= start);
  }, [allCheckins, getPeriodStart]);

  const formatHours = (total: number) => {
    if (total < 1 && total > 0) return `${Math.round(total * 60)}min`;
    return `${total.toFixed(1)}h`;
  };

  const computeEventHours = () => {
    const start = getPeriodStart();
    return eventHours
      .filter((f) => new Date(f.starts_at) >= start)
      .reduce((sum, f) => sum + f.hours_played, 0);
  };

  const computeTotalTime = () => {
    let totalMs = 0;
    for (const entry of filteredCheckins) {
      if (entry.ended_at) {
        totalMs += new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
      }
    }
    const checkinHours = totalMs / 3600000;
    const total = checkinHours + computeEventHours();
    return formatHours(total);
  };

  const grouped = groupByDay(displayHistory);

  const filteredVenueCount = useMemo(() => {
    const start = getPeriodStart();
    const ids = new Set<number>();
    for (const c of filteredCheckins) ids.add(c.venue_id);
    for (const ev of eventVenues) {
      if (new Date(ev.starts_at) >= start) ids.add(ev.venue_id);
    }
    return ids.size;
  }, [filteredCheckins, eventVenues, getPeriodStart]);

  // Days the user played (checkins + event participation)
  const playedDays = useMemo(() => {
    const days = new Set<string>();
    for (const c of allCheckins) {
      days.add(new Date(c.started_at).toDateString());
    }
    for (const ev of eventVenues) {
      days.add(new Date(ev.starts_at).toDateString());
    }
    return days;
  }, [allCheckins, eventVenues]);

  // Calendar: full month grid, offset by calMonthOffset
  const calMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
  }, [calMonthOffset]);

  const calendarWeeks = useMemo(() => {
    const targetMonth = calMonth.getMonth();
    const monthStart = new Date(calMonth);
    const monthEnd = new Date(calMonth.getFullYear(), targetMonth + 1, 0);

    // Find Monday before (or on) the 1st
    const firstDay = new Date(monthStart);
    const dow = firstDay.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    firstDay.setDate(firstDay.getDate() + mondayOffset);

    // Find Sunday after (or on) the last day
    const lastDay = new Date(monthEnd);
    const endDow = lastDay.getDay();
    if (endDow !== 0) lastDay.setDate(lastDay.getDate() + (7 - endDow));

    const weeks: { days: { date: Date; inMonth: boolean }[] }[] = [];
    const cursor = new Date(firstDay);
    while (cursor <= lastDay) {
      const week: { date: Date; inMonth: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor);
        week.push({ date: d, inMonth: d.getMonth() === targetMonth });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push({ days: week });
    }
    return weeks;
  }, [calMonth]);

  // Activities for the selected day
  const selectedDayActivities = useMemo(() => {
    if (!selectedDay) return null;
    const activities: { type: 'checkin' | 'event'; title: string; hours: number | null; time: string }[] = [];

    for (const c of allCheckins) {
      if (new Date(c.started_at).toDateString() === selectedDay) {
        let hours: number | null = null;
        if (c.ended_at) {
          hours = (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 3600000;
        }
        const time = new Date(c.started_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        activities.push({ type: 'checkin', title: c.venue_name || s('venue'), hours, time });
      }
    }

    for (const ev of eventVenues) {
      if (new Date(ev.starts_at).toDateString() === selectedDay) {
        const time = new Date(ev.starts_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        activities.push({ type: 'event', title: ev.event_title, hours: ev.hours_played, time });
      }
    }

    activities.sort((a, b) => a.time.localeCompare(b.time));

    const totalHours = activities.reduce((sum, a) => sum + (a.hours ?? 0), 0);
    return { activities, totalHours };
  }, [selectedDay, allCheckins, eventVenues, s]);

  const summaryStats = [
    { value: String(filteredCheckins.length), label: s('checkins'), bg: colors.primaryPale, color: colors.primary },
    { value: String(filteredVenueCount), label: s('locations'), bg: colors.purplePale, color: colors.purple },
    { value: computeTotalTime(), label: s('timePlayed'), bg: colors.amberPale, color: colors.accent },
    { value: formatHours(computeEventHours()), label: s('hoursInEvents'), bg: colors.bluePale, color: colors.blue },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('playHistoryTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll}>
          {/* Stats Card — period filter + summary */}
          <View style={styles.statsCard}>
            <View style={styles.periodRowCenter}>
              {(['week', 'month', 'year', 'all'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                    {s(p === 'week' ? 'periodWeek' : p === 'month' ? 'periodMonth' : p === 'year' ? 'periodYear' : 'periodAll')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.statsRow}>
              {summaryStats.map((stat) => (
                <View key={stat.label} style={[styles.statPill, { backgroundColor: stat.bg }]}>
                  <AnimatedCounter
                    key={`${stat.label}-${period}`}
                    value={stat.value}
                    style={[styles.statValue, { color: stat.color }]}
                  />
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Streak Bar */}
          <View style={styles.streakBar}>
            <Lucide name="flame" size={18} color={colors.accentBright} />
            <Text style={styles.streakText}>{s('playHistoryLabel')}</Text>
          </View>

          {/* Activity Calendar */}
          <View style={styles.calCard}>
            <View style={styles.calHeader}>
              <TouchableOpacity
                onPress={() => setCalMonthOffset((o) => Math.max(o - 1, -12))}
                disabled={calMonthOffset <= -12}
                style={styles.calNavBtn}
              >
                <Lucide name="chevron-left" size={20} color={calMonthOffset <= -12 ? colors.borderLight : colors.text} />
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>
                {calMonth.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                onPress={() => setCalMonthOffset((o) => Math.min(o + 1, 12))}
                disabled={calMonthOffset >= 12}
                style={styles.calNavBtn}
              >
                <Lucide name="chevron-right" size={20} color={calMonthOffset >= 12 ? colors.borderLight : colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.calWeekdayRow}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <Text key={i} style={styles.calWeekday}>{d}</Text>
              ))}
            </View>
            {calendarWeeks.map((week, wi) => (
              <View key={wi} style={styles.calWeekRow}>
                {week.days.map((day, di) => {
                  const isToday = day.date.toDateString() === new Date().toDateString();
                  const played = day.inMonth && playedDays.has(day.date.toDateString());
                  const isFuture = day.date > new Date();
                  const isSelected = day.date.toDateString() === selectedDay;
                  return (
                    <TouchableOpacity
                      key={di}
                      style={styles.calDayCell}
                      activeOpacity={0.7}
                      onPress={() => {
                        const key = day.date.toDateString();
                        setSelectedDay((prev) => prev === key ? null : key);
                      }}
                    >
                      <View style={[
                        styles.calDay,
                        isToday && styles.calDayToday,
                        played && !isToday && styles.calDayPlayed,
                        isSelected && {
                          borderWidth: 1,
                          borderColor: isToday ? colors.primaryMid : played ? colors.accent : colors.textMuted,
                        },
                      ]}>
                        <Text style={[
                          styles.calDayText,
                          isToday && styles.calDayTodayText,
                          isSelected && styles.calDaySelectedText,
                          !day.inMonth && !isSelected && styles.calDayOutsideText,
                          isFuture && day.inMonth && !isSelected && styles.calDayFutureText,
                        ]}>
                          {day.date.getDate()}
                        </Text>
                        {played && (
                          <Lucide name="flame" size={10} color={colors.accentBright} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Selected Day Detail */}
          {selectedDayActivities && (
            <View style={styles.dayDetail}>
              <View style={styles.dayDetailHeader}>
                <Text style={styles.dayDetailTitle}>
                  {new Date(selectedDay!).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                {selectedDayActivities.totalHours > 0 && (
                  <Text style={styles.dayDetailTotal}>
                    {selectedDayActivities.totalHours.toFixed(1)}h {s('timePlayed').toLowerCase()}
                  </Text>
                )}
              </View>
              {selectedDayActivities.activities.length === 0 ? (
                <Text style={styles.dayDetailEmpty}>{s('noActivity')}</Text>
              ) : (
                selectedDayActivities.activities.map((act, i) => (
                  <View key={i} style={styles.dayDetailRow}>
                    <View style={[styles.dayDetailIcon, { backgroundColor: act.type === 'event' ? colors.amberPale : colors.primaryPale }]}>
                      <Lucide
                        name={act.type === 'event' ? 'calendar' : 'map-pin'}
                        size={14}
                        color={act.type === 'event' ? colors.accent : colors.primaryLight}
                      />
                    </View>
                    <View style={styles.dayDetailInfo}>
                      <Text style={styles.dayDetailName} numberOfLines={1}>{act.title}</Text>
                      <Text style={styles.dayDetailMeta}>
                        {act.time}{act.hours != null ? ` · ${act.hours.toFixed(1)}h` : ''}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Timeline */}
          {displayHistory.length > 0 && (
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
