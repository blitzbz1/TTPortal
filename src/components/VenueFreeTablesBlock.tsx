// F011: one-tap free-table reports. Shows the latest fresh report (anonymous,
// decays ~90 min) and, when the viewer is on-site (checked in), a tap prompt to
// report how many tables are free, scaled to the venue's known table count.
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';
import type { VenueFreeTables } from '../services/venueIntel';

interface Props {
  /** Latest fresh report to display (omit on the post-check-in sheet). */
  freeTables?: VenueFreeTables | null;
  /** Known table count — caps the option buttons. */
  tablesCount?: number | null;
  /** Whether to show the report prompt (true when the viewer is checked in). */
  canReport?: boolean;
  /** Submit a report. Resolves/throws; the prompt shows a thanks state on success. */
  onReport?: (freeCount: number, groupSize: number | null) => Promise<void> | void;
  /** Tighter layout for the check-in success sheet. */
  compact?: boolean;
}

export function VenueFreeTablesBlock({
  freeTables,
  tablesCount,
  canReport = false,
  onReport,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [groupSize, setGroupSize] = useState(0); // 0 = not specified

  // Option buttons: 0..cap, where cap respects the known table count (3 max).
  const cap = tablesCount && tablesCount > 0 ? Math.min(tablesCount, 3) : 3;
  const options = Array.from({ length: cap + 1 }, (_, i) => i);
  const showPlus = tablesCount == null || tablesCount > cap;

  const handleReport = async (freeCount: number) => {
    if (!onReport || submitting) return;
    setSubmitting(true);
    try {
      await onReport(freeCount, groupSize > 0 ? groupSize : null);
      setSubmitted(true);
    } catch {
      // The parent surfaces the error (rate limit, offline); keep the prompt
      // open so the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  const ageText = (m: number) =>
    m < 1 ? s('freeTablesJustNow') : s('freeTablesMinAgo', String(m));

  const showPrompt = canReport && !!onReport && !submitted;
  if (!freeTables && !showPrompt && !submitted) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact && (
        <View style={styles.titleRow}>
          <Lucide name="table-2" size={16} color={colors.primaryMid} />
          <Text style={styles.title}>{s('freeTablesTitle')}</Text>
        </View>
      )}

      {/* Latest fresh report (anonymous). */}
      {freeTables ? (
        <Text style={styles.latest} testID="free-tables-latest">
          {s('freeTablesCountLabel', String(freeTables.free_count))}
          {' · '}
          {ageText(freeTables.age_minutes)}
        </Text>
      ) : null}

      {/* Report prompt — on-site only. */}
      {submitted ? (
        <View style={styles.thanksRow}>
          <Lucide name="check-circle" size={14} color={colors.primaryLight} />
          <Text style={styles.thanks}>{s('freeTablesThanks')}</Text>
        </View>
      ) : showPrompt ? (
        <>
          <Text style={styles.prompt}>{s('freeTablesPrompt')}</Text>
          <View style={styles.optionsRow}>
            {options.map((n) => {
              const isTop = n === cap && showPlus;
              return (
                <TouchableOpacity
                  key={n}
                  style={styles.optionBtn}
                  disabled={submitting}
                  onPress={() => handleReport(n)}
                  accessibilityRole="button"
                  testID={`free-tables-opt-${n}`}
                >
                  <Text style={styles.optionText}>{isTop ? `${n}+` : String(n)}</Text>
                </TouchableOpacity>
              );
            })}
            {submitting ? <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 6 }} /> : null}
          </View>

          {/* Optional group-size stepper. */}
          <View style={styles.groupRow}>
            <Text style={styles.groupLabel}>{s('freeTablesGroupLabel')}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setGroupSize((g) => Math.max(0, g - 1))}
                accessibilityRole="button"
                accessibilityLabel="-"
                testID="free-tables-group-minus"
              >
                <Lucide name="minus" size={14} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.groupValue}>{groupSize > 0 ? String(groupSize) : '—'}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setGroupSize((g) => Math.min(20, g + 1))}
                accessibilityRole="button"
                accessibilityLabel="+"
                testID="free-tables-group-plus"
              >
                <Lucide name="plus" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.bgAlt,
      padding: Spacing.md,
      gap: 8,
    },
    wrapCompact: {
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: Spacing.sm,
      width: '100%',
      gap: 8,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.primaryMid,
    },
    latest: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    prompt: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textMuted },
    optionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionBtn: {
      minWidth: 44,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      alignItems: 'center',
    },
    optionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.primaryMid,
    },
    groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    groupLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint, flex: 1 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      minWidth: 20,
      textAlign: 'center',
    },
    thanksRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    thanks: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.primaryLight },
  });
}
