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
import type { ReportReason } from '../services/moderation';

const REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'hate_speech',
  'sexual_content',
  'misinformation',
  'other',
];

const REASON_LABEL_KEYS: Record<ReportReason, string> = {
  spam: 'reportReasonSpam',
  harassment: 'reportReasonHarassment',
  hate_speech: 'reportReasonHateSpeech',
  sexual_content: 'reportReasonSexualContent',
  misinformation: 'reportReasonMisinformation',
  other: 'reportReasonOther',
};

export type ReportReasonModalProps = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, notes: string | undefined) => void;
};

export function ReportReasonModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: ReportReasonModalProps) {
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState('');

  const handleClose = useCallback(() => {
    setReason(null);
    setNotes('');
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    if (!reason) return;
    onSubmit(reason, notes.trim() ? notes.trim() : undefined);
    setReason(null);
    setNotes('');
  }, [reason, notes, onSubmit]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel={s('cancel')}
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{s('reportTitle')}</Text>
          <Pressable
            onPress={handleClose}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            testID="report-modal-close"
          >
            <Lucide name="x" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{s('reportSubtitle')}</Text>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.sectionLabel}>{s('reportPickReason')}</Text>
          {REASONS.map((r) => {
            const selected = reason === r;
            return (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`report-reason-${r}`}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.reasonText}>{s(REASON_LABEL_KEYS[r])}</Text>
              </Pressable>
            );
          })}

          {reason === 'other' && (
            <TextInput
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              placeholder={s('reportNotesPlaceholder')}
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={500}
              testID="report-notes-input"
            />
          )}
        </ScrollView>

        <Pressable
          onPress={handleSubmit}
          disabled={!reason || submitting}
          style={[styles.submitBtn, (!reason || submitting) && styles.submitBtnDisabled]}
          testID="report-submit"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.submitText}>{s('reportSubmit')}</Text>
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
      maxHeight: '80%',
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
    sectionLabel: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      marginBottom: 8,
      backgroundColor: colors.bgAlt,
    },
    reasonRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryPale,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    reasonText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.text,
    },
    notes: {
      marginTop: 8,
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
