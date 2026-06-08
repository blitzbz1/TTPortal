import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius } from '../theme';
import { useI18n } from '../hooks/useI18n';
import type { VenueChangeRequestInput } from '../services/venueChangeRequests';

type TriValue = boolean | null;

export type VenueChangeRequestModalProps = {
  visible: boolean;
  submitting?: boolean;
  /** Current venue values, shown as context next to each field. */
  current?: {
    nets?: boolean | null;
    night_lighting?: boolean | null;
    tables_count?: number | null;
  };
  onClose: () => void;
  onSubmit: (payload: VenueChangeRequestInput) => void;
};

const MAX_TABLES = 200;

export function VenueChangeRequestModal({
  visible,
  submitting,
  current,
  onClose,
  onSubmit,
}: VenueChangeRequestModalProps) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [nets, setNets] = useState<TriValue>(null);
  const [lighting, setLighting] = useState<TriValue>(null);
  const [tables, setTables] = useState('');
  const [markUnavailable, setMarkUnavailable] = useState(false);
  const [note, setNote] = useState('');

  const reset = useCallback(() => {
    setNets(null);
    setLighting(null);
    setTables('');
    setMarkUnavailable(false);
    setNote('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const tablesTrimmed = tables.trim();
  const tablesNum = tablesTrimmed === '' ? null : Number(tablesTrimmed);
  const tablesValid =
    tablesNum != null &&
    Number.isInteger(tablesNum) &&
    tablesNum >= 0 &&
    tablesNum <= MAX_TABLES;
  const tablesProvided = tablesTrimmed !== '' && tablesValid;

  const hasChange =
    nets !== null || lighting !== null || tablesProvided || markUnavailable;

  const handleSubmit = useCallback(() => {
    if (!hasChange) return;
    onSubmit({
      nets,
      nightLighting: lighting,
      tablesCount: tablesProvided ? tablesNum : null,
      markUnavailable,
      note: note.trim() ? note.trim() : null,
    });
    reset();
  }, [hasChange, nets, lighting, tablesProvided, tablesNum, markUnavailable, note, onSubmit, reset]);

  const renderTriState = (
    field: string,
    label: string,
    currentValue: boolean | null | undefined,
    value: TriValue,
    onChange: (v: TriValue) => void,
  ) => {
    const options: { v: TriValue; label: string }[] = [
      { v: null, label: s('vcrNoChange') },
      { v: true, label: s('yes') },
      { v: false, label: s('no') },
    ];
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {currentValue != null ? (
            <Text style={styles.labelHint}>
              {'  ·  '}
              {s('vcrCurrent')}: {currentValue ? s('yes') : s('no')}
            </Text>
          ) : null}
        </Text>
        <View style={styles.choiceRow}>
          {options.map((o) => {
            const active = value === o.v;
            return (
              <Pressable
                key={String(o.v)}
                onPress={() => onChange(o.v)}
                style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                testID={`vcr-${field}-${String(o.v)}`}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable
        style={styles.backdrop}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel={s('cancel')}
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{s('vcrTitle')}</Text>
          <Pressable
            onPress={handleClose}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            testID="vcr-modal-close"
          >
            <Lucide name="x" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{s('vcrSubtitle')}</Text>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {renderTriState('nets', s('vcrFieldNets'), current?.nets, nets, setNets)}
          {renderTriState('lighting', s('vcrFieldLighting'), current?.night_lighting, lighting, setLighting)}

          <View style={styles.field}>
            <Text style={styles.label}>
              {s('vcrFieldTables')}
              {current?.tables_count != null ? (
                <Text style={styles.labelHint}>
                  {'  ·  '}
                  {s('vcrCurrent')}: {current.tables_count}
                </Text>
              ) : null}
            </Text>
            <TextInput
              style={styles.input}
              value={tables}
              onChangeText={setTables}
              placeholder={s('vcrNoChange')}
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={3}
              testID="vcr-tables-input"
            />
          </View>

          <Pressable
            onPress={() => setMarkUnavailable((v) => !v)}
            style={[styles.unavailRow, markUnavailable && styles.unavailRowActive]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: markUnavailable }}
            testID="vcr-unavailable"
          >
            <View style={[styles.checkbox, markUnavailable && styles.checkboxActive]}>
              {markUnavailable && <Lucide name="check" size={14} color={colors.textOnPrimary} />}
            </View>
            <Text style={styles.unavailText}>{s('vcrUnavailableToggle')}</Text>
          </Pressable>

          <TextInput
            style={styles.notes}
            value={note}
            onChangeText={setNote}
            placeholder={s('vcrNotePlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={500}
            testID="vcr-note-input"
          />
        </ScrollView>

        <Pressable
          onPress={handleSubmit}
          disabled={!hasChange || submitting}
          style={[styles.submitBtn, (!hasChange || submitting) && styles.submitBtnDisabled]}
          testID="vcr-submit"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.submitText}>{s('vcrSubmit')}</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      marginBottom: 4,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    subtitle: {
      paddingHorizontal: Spacing.md,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: Spacing.md,
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
    },
    field: {
      gap: 8,
      marginBottom: Spacing.md,
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    labelHint: {
      fontWeight: FontWeight.medium,
      color: colors.textFaint,
      letterSpacing: 0.4,
      textTransform: 'none',
    },
    choiceRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    choiceBtn: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    choiceBtnActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primary,
    },
    choiceText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    choiceTextActive: {
      color: colors.primaryMid,
      fontWeight: FontWeight.semibold,
    },
    input: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      height: 44,
      paddingHorizontal: 12,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unavailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      marginBottom: Spacing.md,
      backgroundColor: colors.bgAlt,
    },
    unavailRowActive: {
      borderColor: colors.red,
      backgroundColor: colors.redPale,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      borderColor: colors.red,
      backgroundColor: colors.red,
    },
    unavailText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.text,
    },
    notes: {
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      padding: 12,
      minHeight: 80,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.text,
      textAlignVertical: 'top',
    },
    submitBtn: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  });
}
