import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { getDateLocale } from '../contexts/I18nProvider';
import type { RubberSide, RubberWear } from '../types/database';
import { createStyles } from '../screens/EquipmentScreen.styles';

const EXPECTED_MIN = 10;
const EXPECTED_MAX = 1000;
const EXPECTED_STEP = 10;
const DEFAULT_EXPECTED = 60;

const _wearDateFmtByLocale = new Map<string, Intl.DateTimeFormat>();
function formatWearDate(value: string, locale: string) {
  let fmt = _wearDateFmtByLocale.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    _wearDateFmtByLocale.set(locale, fmt);
  }
  return fmt.format(new Date(value));
}

/** YYYY-MM-DD in local time (the DB column is a `date`). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a `date` string ("YYYY-MM-DD") at LOCAL midnight. `new Date(str)` parses
 *  it as UTC, which toIsoDate() then reads back a day early for negative-UTC
 *  zones (Americas) — shifting the displayed date and keeping the card forever
 *  "dirty". Building from parts pins it local so toIsoDate round-trips exactly. */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export interface RubberWearCardProps {
  side: RubberSide;
  /** The wear row for this side, if a tracker has been set up. */
  wear?: RubberWear;
  /** Fallback install date (e.g. the latest equipment_history date) shown as a
   *  suggestion when no tracker exists yet. */
  suggestedInstalledAt?: string;
  saving?: boolean;
  onInstall: (input: { side: RubberSide; installedAt: string; expectedHours: number }) => void;
}

export function RubberWearCard({
  side,
  wear,
  suggestedInstalledAt,
  saving = false,
  onInstall,
}: RubberWearCardProps) {
  const { colors } = useTheme();
  const { s, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = getDateLocale(lang);

  const installedAt = wear?.installed_at ?? suggestedInstalledAt ?? toIsoDate(new Date());
  const [draftExpected, setDraftExpected] = useState<number>(wear?.expected_hours ?? DEFAULT_EXPECTED);
  const [draftDate, setDraftDate] = useState<Date>(() => parseLocalDate(installedAt));
  const [showPicker, setShowPicker] = useState(false);

  // When the server value arrives/changes, follow it (a re-rubber resets these).
  const wearKey = `${wear?.installed_at ?? ''}:${wear?.expected_hours ?? ''}`;
  const lastWearKey = React.useRef(wearKey);
  if (lastWearKey.current !== wearKey) {
    lastWearKey.current = wearKey;
    if (wear) {
      setDraftExpected(wear.expected_hours);
      setDraftDate(parseLocalDate(wear.installed_at));
    }
  }

  const pct = wear?.pct ?? 0;
  const estimated = wear?.estimated_hours ?? 0;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const barColor = pct >= 100 ? colors.red : pct >= 80 ? colors.amber : colors.primary;

  const title = side === 'forehand' ? s('equipmentForehandRubber') : s('equipmentBackhandRubber');
  const icon = side === 'forehand' ? 'zap' : 'shield';
  const accent = side === 'forehand' ? colors.red : colors.black;

  const adjustExpected = useCallback((delta: number) => {
    setDraftExpected((prev) => {
      const next = Math.round((prev + delta) / EXPECTED_STEP) * EXPECTED_STEP;
      return Math.max(EXPECTED_MIN, Math.min(EXPECTED_MAX, next));
    });
  }, []);

  const onDateChange = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setDraftDate(selected);
  }, []);

  const handleReset = useCallback(() => {
    onInstall({ side, installedAt: toIsoDate(new Date()), expectedHours: draftExpected });
  }, [onInstall, side, draftExpected]);

  const handleApply = useCallback(() => {
    onInstall({ side, installedAt: toIsoDate(draftDate), expectedHours: draftExpected });
  }, [onInstall, side, draftDate, draftExpected]);

  const hasTracker = !!wear;
  // The draft differs from what's stored (or there's no tracker yet) → applying
  // is meaningful.
  const dirty =
    !hasTracker ||
    draftExpected !== wear?.expected_hours ||
    toIsoDate(draftDate) !== wear?.installed_at;

  return (
    <View style={styles.wearGroup} testID={`wear-card-${side}`}>
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: accent }]}>
          <Lucide name={icon} size={18} color={colors.textOnPrimary} />
        </View>
        <View style={styles.groupTitleWrap}>
          <Text style={styles.groupTitle}>{title}</Text>
          <Text style={styles.groupSubtitle}>{s('wearCardSubtitle')}</Text>
        </View>
      </View>

      {/* Installed-on date (editable) */}
      <View style={styles.wearRow}>
        <Text style={styles.wearControlLabel}>{s('wearInstalledOn')}</Text>
        <TouchableOpacity
          style={[styles.wearDateBtn, showPicker && styles.wearDateBtnActive]}
          onPress={() => setShowPicker((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={s('wearInstalledOn')}
          testID={`wear-date-${side}`}
        >
          <Lucide name="calendar" size={15} color={colors.primaryMid} />
          <Text style={styles.wearDateText}>{formatWearDate(toIsoDate(draftDate), dateLocale)}</Text>
        </TouchableOpacity>
      </View>
      {showPicker && (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={new Date()}
          onChange={onDateChange}
        />
      )}

      {/* Expected lifespan stepper */}
      <View style={styles.wearRow}>
        <Text style={styles.wearControlLabel}>{s('wearExpectedHours')}</Text>
        <View style={styles.wearStepper}>
          <TouchableOpacity
            style={styles.wearStepBtn}
            onPress={() => adjustExpected(-EXPECTED_STEP)}
            disabled={draftExpected <= EXPECTED_MIN}
            accessibilityRole="button"
            accessibilityLabel={s('wearDecrease')}
            testID={`wear-expected-minus-${side}`}
          >
            <Lucide name="minus" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.wearStepValue} testID={`wear-expected-value-${side}`}>
            {s('wearHoursValue', String(draftExpected))}
          </Text>
          <TouchableOpacity
            style={styles.wearStepBtn}
            onPress={() => adjustExpected(EXPECTED_STEP)}
            disabled={draftExpected >= EXPECTED_MAX}
            accessibilityRole="button"
            accessibilityLabel={s('wearIncrease')}
            testID={`wear-expected-plus-${side}`}
          >
            <Lucide name="plus" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Estimated vs expected + pct bar */}
      <View>
        <View style={styles.wearStatRow}>
          <Text style={styles.wearStatHours}>
            {s('wearEstimatedHours', String(estimated), String(wear?.expected_hours ?? draftExpected))}
          </Text>
          <Text style={[styles.wearStatPct, { color: barColor }]} testID={`wear-pct-${side}`}>
            {s('wearPercentWorn', String(pct))}
          </Text>
        </View>
        <View style={[styles.wearBarTrack, { marginTop: 8 }]}>
          <View style={[styles.wearBarFill, { width: `${clampedPct}%`, backgroundColor: barColor }]} />
        </View>
      </View>

      {/* "New rubber" (reset clock to today) only for an existing, unchanged
          tracker; otherwise Apply honors the picked install date — incl. the
          first-time setup case, which previously dropped the chosen date and
          recorded today. */}
      <TouchableOpacity
        style={styles.wearResetBtn}
        onPress={hasTracker && !dirty ? handleReset : handleApply}
        disabled={saving}
        accessibilityRole="button"
        testID={`wear-reset-${side}`}
      >
        <Text style={styles.wearResetText}>
          {hasTracker && !dirty ? s('wearNewRubber') : s('wearApply')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
