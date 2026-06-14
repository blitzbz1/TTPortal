// F010: live busyness + typical-hours histogram on venue detail.
// Data comes from get_venue_busyness (migration 106), merged into the venue
// bundle by useVenueDetailQuery. Counts only — no identities (084 privacy
// contract). Renders the empty state below the server-side sample threshold.
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { Card } from './Card';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';
import type { VenueBusyness } from '../services/venueIntel';

// The "popular times" window — table-tennis play clusters in the afternoon
// and evening, so 7am–10pm keeps the chart legible without dead pre-dawn bars.
const START_HOUR = 7;
const END_HOUR = 22;
const BAR_AREA_HEIGHT = 56;

interface Props {
  busyness: VenueBusyness | null | undefined;
  /** Known table count, folded into the live line ("3 here now · 5 tables"). */
  tablesCount?: number | null;
}

export function VenueBusynessBlock({ busyness, tablesCount }: Props) {
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = getDateLocale(lang);

  const now = new Date();
  const todayDow = now.getDay();
  const currentHour = now.getHours();
  const [selectedDow, setSelectedDow] = useState(todayDow);

  // Hours for the selected weekday (fall back to the all-days curve). Kept
  // before the early return so hook order stays stable when busyness is null.
  const hourCounts = useMemo(() => {
    const byDay = busyness?.by_weekday?.[String(selectedDow)];
    const source = byDay && byDay.length > 0 ? byDay : busyness?.histogram ?? [];
    const map = new Map<number, number>();
    for (const h of source) map.set(h.hour, h.count);
    return map;
  }, [busyness, selectedDow]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const c of hourCounts.values()) m = Math.max(m, c);
    return m;
  }, [hourCounts]);

  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, dow) =>
        // 2024-01-07 is a Sunday (dow 0); +dow walks the week, localized.
        new Date(Date.UTC(2024, 0, 7 + dow)).toLocaleDateString(dateLocale, { weekday: 'narrow' }),
      ),
    [dateLocale],
  );

  // Nothing to show at all (RPC missing/errored).
  if (!busyness) return null;

  const liveCount = busyness.live_count ?? 0;
  const hasHistogram = !!busyness.histogram && busyness.histogram.length > 0;
  const peakLabel =
    busyness.peak_hour != null
      ? `${String(busyness.peak_hour).padStart(2, '0')}:00`
      : null;

  return (
    <Card shadow="sm" borderRadius={0} style={styles.section}>
      <View style={styles.titleRow}>
        <Lucide name="activity" size={16} color={colors.blue} />
        <Text style={styles.title}>{s('venueBusynessTitle')}</Text>
      </View>

      {/* Live line */}
      <View style={styles.liveRow}>
        <View style={[styles.liveDot, { backgroundColor: liveCount > 0 ? colors.primaryLight : colors.textFaint }]} />
        <Text style={styles.liveText}>
          {liveCount > 0
            ? s('venueBusynessHereNow', String(liveCount)) +
              (tablesCount ? ` · ${tablesCount} ${s('tables')}` : '')
            : s('venueBusynessQuiet')}
        </Text>
      </View>

      {hasHistogram ? (
        <>
          {/* Weekday selector */}
          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, dow) => {
              const active = dow === selectedDow;
              return (
                <TouchableOpacity
                  key={dow}
                  style={[styles.weekdayBtn, active && styles.weekdayBtnActive]}
                  onPress={() => setSelectedDow(dow)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  testID={`busyness-dow-${dow}`}
                >
                  <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Histogram */}
          <View style={styles.bars} accessibilityLabel={peakLabel ? s('venueBusynessPeak', peakLabel) : undefined}>
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
              const hour = START_HOUR + i;
              const count = hourCounts.get(hour) ?? 0;
              const ratio = maxCount > 0 ? count / maxCount : 0;
              const isNow = selectedDow === todayDow && hour === currentHour;
              return (
                <View key={hour} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(2, Math.round(ratio * BAR_AREA_HEIGHT)),
                        backgroundColor: isNow ? colors.primary : colors.blue,
                        opacity: count > 0 ? 1 : 0.25,
                      },
                    ]}
                  />
                  {hour % 4 === 0 ? <Text style={styles.barLabel}>{hour}</Text> : <Text style={styles.barLabel}> </Text>}
                </View>
              );
            })}
          </View>

          {peakLabel ? (
            <Text style={styles.peakText}>{s('venueBusynessPeak', peakLabel)}</Text>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyRow}>
          <Lucide name="bar-chart-2" size={14} color={colors.textFaint} />
          <Text style={styles.emptyText}>{s('venueBusynessEmpty')}</Text>
        </View>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      backgroundColor: colors.bgAlt,
      padding: Spacing.md,
      gap: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.blue,
    },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    liveText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text, flex: 1 },
    weekdayRow: { flexDirection: 'row', gap: 4 },
    weekdayBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 5,
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
    },
    weekdayBtnActive: { backgroundColor: colors.bluePale, borderWidth: 1, borderColor: colors.blue },
    weekdayText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    weekdayTextActive: { color: colors.blue, fontWeight: FontWeight.bold },
    bars: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_AREA_HEIGHT + 14, gap: 2 },
    barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    bar: { width: '70%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    barLabel: { fontFamily: Fonts.body, fontSize: 9, color: colors.textFaint, marginTop: 2 },
    peakText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    emptyText: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint, flex: 1 },
  });
}
