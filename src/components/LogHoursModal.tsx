import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { logEventHours } from '../services/events';
import { invalidateEventsCache } from '../lib/eventsCache';
import { safeErrorMessage } from '../lib/auth-utils';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import type { ThemeColors } from '../theme';

const HOUR_PRESETS = [1, 1.5, 2, 3];

interface Props {
  visible: boolean;
  eventId: number | null;
  eventTitle?: string;
  initialHours?: number;
  onDismiss: () => void;
}

export function LogHoursModal({ visible, eventId, eventTitle, initialHours, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s } = useI18n();
  const { user } = useSession();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setHours(initialHours && initialHours > 0 ? String(initialHours) : '');
  }, [visible, initialHours]);

  const submit = useCallback(async () => {
    const parsed = parseFloat(hours);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert(s('error'), s('hoursPlayedPlaceholder'));
      return;
    }
    if (!user || !eventId) return;

    setSaving(true);
    const { error } = await logEventHours(eventId, user.id, parsed);
    setSaving(false);

    if (error) {
      Alert.alert(s('error'), safeErrorMessage(error, 'genericError', s));
      return;
    }
    // Hours changed; the past tab embeds participant.hours_played, so the
    // cached list is now stale.
    invalidateEventsCache(user.id, ['past']);
    hapticSuccess();
    onDismiss();
  }, [hours, user, eventId, onDismiss, s]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
        <Pressable style={styles.overlay} onPress={onDismiss}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.sm }]} onPress={() => {}}>
            <View style={styles.handleWrap}>
              <View style={styles.handleBar} />
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>{s('logHoursTitle')}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
                <Lucide name="x" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              bottomOffset={20}
              showsVerticalScrollIndicator={false}
            >
            {eventTitle ? (
              <View style={styles.eventRow}>
                <Lucide name="calendar" size={14} color={colors.textFaint} />
                <Text style={styles.eventText} numberOfLines={1}>{eventTitle}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{s('hoursPlayed')}</Text>
              <TextInput
                style={styles.input}
                placeholder={s('hoursPlayedPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
                maxLength={4}
                autoFocus
              />
              <View style={styles.presets}>
                {HOUR_PRESETS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.chip, hours === String(h) && styles.chipActive]}
                    onPress={() => { hapticLight(); setHours(String(h)); }}
                  >
                    <Text style={[styles.chipText, hours === String(h) && styles.chipTextActive]}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                <Text style={styles.cancelText}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  : <Text style={styles.saveText}>{s('save')}</Text>
                }
              </TouchableOpacity>
            </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlayHeavy, justifyContent: 'flex-end', alignItems: 'center' },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      width: '100%',
      maxWidth: 430,
      ...Shadows.lg,
    },
    handleWrap: { alignItems: 'center', justifyContent: 'center', height: 28 },
    handleBar: { width: 36, height: 4, borderRadius: 100, backgroundColor: colors.border },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    },
    title: { fontFamily: Fonts.heading, fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: colors.text },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg },
    eventText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, flex: 1 },
    field: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: 6 },
    fieldLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textFaint, letterSpacing: 0.7 },
    input: {
      backgroundColor: colors.bg, borderRadius: 8, height: 42, paddingHorizontal: 12,
      borderWidth: 1, borderColor: colors.border, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text,
    },
    presets: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4 },
    chip: {
      paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 16,
      backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: 'transparent',
    },
    chipActive: { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim },
    chipText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    chipTextActive: { color: colors.primaryMid, fontWeight: FontWeight.semibold },
    actions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.md, paddingHorizontal: Spacing.lg },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, height: 46, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textMuted },
    saveBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary, borderRadius: Radius.md, height: 46, gap: Spacing.xs, ...Shadows.md,
    },
    saveText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
  });
}
