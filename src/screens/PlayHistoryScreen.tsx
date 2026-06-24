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
import { getDateLocale } from '../contexts/I18nProvider';
import { getPlayHistory } from '../services/checkins';
import { usePlayHistoryQuery } from '../hooks/queries/usePlayHistoryQuery';

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

  // Quantize the prepare value so the UI-thread reaction fires once per
  // displayed step (every 0.1 unit for decimals, every 1 unit for integers)
  // rather than every animation frame. Was ~36 setState calls per
  // animation; now O(target / step), and runOnJS bridges drop accordingly.
  useAnimatedReaction(
    () => (isDecimal ? Math.round(sv.value * 10) / 10 : Math.round(sv.value)),
    (current, previous) => {
      if (current === previous) return;
      const formatted = isDecimal ? current.toFixed(1) : current.toString();
      runOnJS(setDisplay)(formatted + suffix);
    },
    [sv, suffix, isDecimal],
  );

  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{display}</Text>;
}

export function PlayHistoryScreen() {
  const [loadingMore, setLoadingMore] = useState(false);
  // Pages beyond the bundle's first are imperative view state (T050).
  const [extraPages, setExtraPages] = useState<any[]>([]);
  const [noMore, setNoMore] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('week');

  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(new Date().toDateString());

  const { user } = useSession();
  const router = useRouter();
  const { s, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Fetch is windowed to the lower bound of (current period, earliest visible
  // calendar month minus 1 month buffer). For period='all' we omit the bound.
  // Recomputing on period/calendar paging keeps load times flat for active
  // accounts that may have hundreds of checkins.
  const sinceIso = useMemo<string | null>(() => {
    if (period === 'all') return null;
    const now = new Date();
    const periodStart =
      period === 'week'
        ? (() => {
            const d = new Date(now);
            const day = d.getDay();
            const diff = day === 0 ? 6 : day - 1;
            d.setDate(d.getDate() - diff);
            d.setHours(0, 0, 0, 0);
            return d;
          })()
        : period === 'month'
          ? new Date(now.getFullYear(), now.getMonth(), 1)
          : new Date(now.getFullYear(), 0, 1);
    // Earliest month the calendar can currently display, minus a 1-month buffer.
    const calStart = new Date(now.getFullYear(), now.getMonth() + Math.min(calMonthOffset, 0) - 1, 1);
    return new Date(Math.min(periodStart.getTime(), calStart.getTime())).toISOString();
  }, [period, calMonthOffset]);

  // T050: the composite bundle (page one + calendar/stat sources) comes
  // from usePlayHistoryQuery — fetch, persistent-cache mirror, and offline
  // hydration all live in the hook.
  const { data: bundle, isLoading } = usePlayHistoryQuery(user?.id, sinceIso);
  const allCheckins = bundle?.allCheckins ?? [];
  const eventHours = bundle?.eventHours ?? [];
  const eventVenues = bundle?.eventVenues ?? [];
  const trainingSessions = bundle?.trainingSessions ?? [];
  const history = useMemo(
    () => [...(bundle?.history ?? []), ...extraPages],
    [bundle, extraPages],
  );
  const loading = isLoading && !bundle;
  const hasMore = !noMore && (bundle?.history?.length ?? 0) >= PAGE_SIZE;

  // New window (period/calendar change) → drop appended pages.
  useEffect(() => {
    setExtraPages([]);
    setNoMore(false);
  }, [sinceIso]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data } = await getPlayHistory(user.id, PAGE_SIZE, history.length);
      if (data && data.length > 0) {
        setExtraPages((prev) => [...prev, ...data]);
        if (data.length < PAGE_SIZE) setNoMore(true);
      } else {
        setNoMore(true);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [user, history.length, loadingMore, hasMore]);

  // Group history entries by day. Sort by timestamp once (input may be unsorted),
  // then walk in order and create a group only on the first occurrence of each
  // dateKey. Map lookup avoids the O(n\u00b2) groups.find() in the legacy version,
  // and toLocaleDateString is invoked at most once per group rather than per entry.
  const groupByDay = (entries: any[]) => {
    const sorted = [...entries].sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const map = new Map<string, { dayLabel: string; dateKey: string; entries: any[] }>();
    const order: string[] = [];

    for (const entry of sorted) {
      const date = new Date(entry.started_at);
      const dateStr = date.toDateString();
      let group = map.get(dateStr);
      if (!group) {
        let dayLabel: string;
        if (dateStr === today) {
          dayLabel = `${s('today')} \u2014 ${date.toLocaleDateString(getDateLocale(lang), { day: 'numeric', month: 'long' })}`;
        } else if (dateStr === yesterday) {
          dayLabel = `${s('yesterday')} \u2014 ${date.toLocaleDateString(getDateLocale(lang), { day: 'numeric', month: 'long' })}`;
        } else {
          dayLabel = date.toLocaleDateString(getDateLocale(lang), { day: 'numeric', month: 'long' });
        }
        group = { dayLabel, dateKey: dateStr, entries: [] };
        map.set(dateStr, group);
        order.push(dateStr);
      }
      group.entries.push(entry);
    }
    return order.map((k) => map.get(k)!);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(getDateLocale(lang), {
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

  // F060: training sessions falling inside the active period.
  const filteredTraining = useMemo(() => {
    const start = getPeriodStart();
    return trainingSessions.filter((t) => new Date(t.created_at) >= start);
  }, [trainingSessions, getPeriodStart]);

  const computeTrainingHours = () =>
    filteredTraining.reduce((sum, t) => sum + Number(t.hours ?? 0), 0);

  // F060: tally each focus area across the period's training sessions.
  const focusDistribution = useMemo(() => {
    const tally = new Map<string, number>();
    for (const t of filteredTraining) {
      for (const f of t.focus ?? []) {
        tally.set(f, (tally.get(f) ?? 0) + 1);
      }
    }
    const entries = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
    const max = entries.reduce((m, [, n]) => Math.max(m, n), 0);
    return { entries, max };
  }, [filteredTraining]);

  const computeTotalTime = () => {
    let totalMs = 0;
    for (const entry of filteredCheckins) {
      if (entry.ended_at) {
        totalMs += new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
      }
    }
    const checkinHours = totalMs / 3600000;
    const total = checkinHours + computeEventHours() + computeTrainingHours();
    return formatHours(total);
  };

  // Memoized: groupByDay sorts + buckets the full (paginated) history into a
  // Map on each call — avoid re-running it on every unrelated re-render.
  const grouped = useMemo(() => groupByDay(displayHistory), [displayHistory, s, lang]);

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
    for (const t of trainingSessions) {
      days.add(new Date(t.created_at).toDateString());
    }
    return days;
  }, [allCheckins, eventVenues, trainingSessions]);

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
    const activities: { type: 'checkin' | 'event' | 'training'; title: string; hours: number | null; time: string }[] = [];

    for (const c of allCheckins) {
      if (new Date(c.started_at).toDateString() === selectedDay) {
        let hours: number | null = null;
        if (c.ended_at) {
          hours = (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 3600000;
        }
        const time = new Date(c.started_at).toLocaleTimeString(getDateLocale(lang), { hour: '2-digit', minute: '2-digit' });
        activities.push({ type: 'checkin', title: c.venue_name || s('venue'), hours, time });
      }
    }

    for (const ev of eventVenues) {
      if (new Date(ev.starts_at).toDateString() === selectedDay) {
        const time = new Date(ev.starts_at).toLocaleTimeString(getDateLocale(lang), { hour: '2-digit', minute: '2-digit' });
        activities.push({ type: 'event', title: ev.event_title, hours: ev.hours_played, time });
      }
    }

    // F060: training sessions logged on the selected day.
    for (const t of trainingSessions) {
      if (new Date(t.created_at).toDateString() === selectedDay) {
        const time = new Date(t.created_at).toLocaleTimeString(getDateLocale(lang), { hour: '2-digit', minute: '2-digit' });
        activities.push({ type: 'training', title: s(`trainingType_${t.session_type}`), hours: Number(t.hours ?? 0), time });
      }
    }

    activities.sort((a, b) => a.time.localeCompare(b.time));

    const totalHours = activities.reduce((sum, a) => sum + (a.hours ?? 0), 0);
    return { activities, totalHours };
  }, [selectedDay, allCheckins, eventVenues, trainingSessions, s, lang]);

  const summaryStats = [
    { value: String(filteredCheckins.length), label: s('checkins'), bg: colors.primaryPale, color: colors.primary },
    { value: String(filteredVenueCount), label: s('locations'), bg: colors.purplePale, color: colors.purple },
    { value: computeTotalTime(), label: s('timePlayed'), bg: colors.amberPale, color: colors.accent },
    { value: formatHours(computeEventHours()), label: s('hoursInEvents'), bg: colors.bluePale, color: colors.blue },
    // F060: training hours logged in the period.
    { value: formatHours(computeTrainingHours()), label: s('trainingStat'), bg: colors.primaryPale, color: colors.primaryMid },
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

          {/* F060: focus-distribution bar — tally of training focus areas. */}
          {focusDistribution.entries.length > 0 && (
            <View style={styles.focusCard} testID="training-focus-distribution">
              <Text style={styles.focusHeader}>{s('trainingFocusDistribution')}</Text>
              {focusDistribution.entries.map(([area, count]) => (
                <View key={area} style={styles.focusRow}>
                  <Text style={styles.focusLabel} numberOfLines={1}>{s(`trainingFocus_${area}`)}</Text>
                  <View style={styles.focusTrack}>
                    <View
                      style={[
                        styles.focusFill,
                        { width: `${focusDistribution.max > 0 ? (count / focusDistribution.max) * 100 : 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.focusCount}>{count}</Text>
                </View>
              ))}
            </View>
          )}

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
                {calMonth.toLocaleDateString(getDateLocale(lang), { month: 'long', year: 'numeric' })}
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
                  {new Date(selectedDay!).toLocaleDateString(getDateLocale(lang), { weekday: 'long', day: 'numeric', month: 'long' })}
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
                    <View style={[styles.dayDetailIcon, { backgroundColor: act.type === 'event' ? colors.amberPale : act.type === 'training' ? colors.purplePale : colors.primaryPale }]}>
                      <Lucide
                        name={act.type === 'event' ? 'calendar' : act.type === 'training' ? 'dumbbell' : 'map-pin'}
                        size={14}
                        color={act.type === 'event' ? colors.accent : act.type === 'training' ? colors.purple : colors.primaryLight}
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
                      onPress={() => router.push({ pathname: '/venue/[id]', params: { id: String(entry.venue_id) } })}
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
