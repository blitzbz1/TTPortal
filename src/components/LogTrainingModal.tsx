import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { showAlert } from '../lib/dialogs';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { logTraining } from '../services/training';
import { getFriends } from '../services/friends';
import { safeErrorMessage } from '../lib/auth-utils';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import type { ThemeColors } from '../theme';
import type { TrainingFocus, TrainingSessionType } from '../types/database';

const HOUR_PRESETS = [1, 1.5, 2, 3];

const SESSION_TYPES: { value: TrainingSessionType; icon: string }[] = [
  { value: 'solo', icon: 'circle-dot' },
  { value: 'partner', icon: 'handshake' },
  { value: 'multiball', icon: 'dumbbell' },
  { value: 'robot', icon: 'bot' },
];

const FOCUS_AREAS: TrainingFocus[] = [
  'serves',
  'receive',
  'footwork',
  'fh_bh_loop',
  'blocking',
  'match_play',
];

const MAX_FOCUS = 3;

interface PartnerOption {
  id: string;
  name: string;
}

interface Props {
  visible: boolean;
  /** Pre-fills the session venue (e.g. from an active check-in). */
  venueId?: number | null;
  venueName?: string | null;
  onDismiss: () => void;
}

export function LogTrainingModal({ visible, venueId = null, venueName, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { s } = useI18n();
  const { user } = useSession();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [sessionType, setSessionType] = useState<TrainingSessionType>('solo');
  const [hours, setHours] = useState('');
  const [focus, setFocus] = useState<TrainingFocus[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSessionType('solo');
    setHours('');
    setFocus([]);
    setPartnerId(null);
    setNote('');
    setPartnerPickerOpen(false);
  }, [visible]);

  // Lazily load the friend list the first time the partner picker opens.
  useEffect(() => {
    if (!visible || !user || partners.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await getFriends(user.id);
      if (cancelled || !data) return;
      const opts: PartnerOption[] = data.map((f: any) => {
        const isRequester = f.requester_id === user.id;
        const profile = isRequester ? f.addressee : f.requester;
        return { id: profile.id, name: profile.full_name ?? '' };
      });
      setPartners(opts);
    })();
    return () => { cancelled = true; };
  }, [visible, user, partners.length]);

  const toggleFocus = useCallback((f: TrainingFocus) => {
    hapticLight();
    setFocus((prev) => {
      if (prev.includes(f)) return prev.filter((x) => x !== f);
      if (prev.length >= MAX_FOCUS) return prev;
      return [...prev, f];
    });
  }, []);

  const partnerName = useMemo(
    () => partners.find((p) => p.id === partnerId)?.name ?? null,
    [partners, partnerId],
  );

  const submit = useCallback(async () => {
    const parsed = parseFloat(hours);
    if (isNaN(parsed) || parsed <= 0) {
      showAlert(s('error'), s('trainingDurationError'));
      return;
    }
    if (focus.length === 0) {
      showAlert(s('error'), s('trainingFocusError'));
      return;
    }
    if (!user) return;

    setSaving(true);
    const { error } = await logTraining({
      user_id: user.id,
      session_type: sessionType,
      hours: parsed,
      focus,
      venue_id: venueId,
      partner_id: sessionType === 'partner' ? partnerId : null,
      note: note.trim() ? note.trim() : null,
    });
    setSaving(false);

    if (error) {
      showAlert(s('error'), safeErrorMessage(error, 'genericError', s));
      return;
    }
    hapticSuccess();
    onDismiss();
  }, [hours, focus, user, sessionType, venueId, partnerId, note, onDismiss, s]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.sm }]} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>{s('trainingLogTitle')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} testID="training-close">
              <Lucide name="x" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bottomOffset={20}
            showsVerticalScrollIndicator={false}
          >
            {venueName ? (
              <View style={styles.venueRow}>
                <Lucide name="map-pin" size={14} color={colors.textFaint} />
                <Text style={styles.venueText} numberOfLines={1}>{venueName}</Text>
              </View>
            ) : null}

            {/* Session type */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{s('trainingTypeLabel')}</Text>
              <View style={styles.chipsWrap}>
                {SESSION_TYPES.map((t) => {
                  const active = sessionType === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => { hapticLight(); setSessionType(t.value); }}
                      testID={`training-type-${t.value}`}
                    >
                      <Lucide name={t.icon} size={14} color={active ? colors.primaryMid : colors.textMuted} />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {s(`trainingType_${t.value}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{s('trainingDurationLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={s('trainingDurationPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
                maxLength={4}
                testID="training-hours"
              />
              <View style={styles.presets}>
                {HOUR_PRESETS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.presetChip, hours === String(h) && styles.chipActive]}
                    onPress={() => { hapticLight(); setHours(String(h)); }}
                  >
                    <Text style={[styles.chipText, hours === String(h) && styles.chipTextActive]}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Focus areas (1–3) */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{s('trainingFocusLabel', String(focus.length), String(MAX_FOCUS))}</Text>
              <View style={styles.chipsWrap}>
                {FOCUS_AREAS.map((f) => {
                  const active = focus.includes(f);
                  const disabled = !active && focus.length >= MAX_FOCUS;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.4 }]}
                      onPress={() => toggleFocus(f)}
                      disabled={disabled}
                      testID={`training-focus-${f}`}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {s(`trainingFocus_${f}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Partner (only for partner sessions) */}
            {sessionType === 'partner' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{s('trainingPartnerLabel')}</Text>
                <TouchableOpacity
                  style={styles.selectRow}
                  onPress={() => setPartnerPickerOpen((o) => !o)}
                  testID="training-partner-toggle"
                >
                  <Text style={[styles.selectText, !partnerName && { color: colors.textFaint }]} numberOfLines={1}>
                    {partnerName ?? s('trainingPartnerNone')}
                  </Text>
                  <Lucide name={partnerPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
                </TouchableOpacity>
                {partnerPickerOpen ? (
                  <View style={styles.partnerList}>
                    {partners.length === 0 ? (
                      <Text style={styles.partnerEmpty}>{s('trainingPartnerEmpty')}</Text>
                    ) : (
                      partners.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.partnerItem}
                          onPress={() => {
                            hapticLight();
                            setPartnerId((prev) => (prev === p.id ? null : p.id));
                            setPartnerPickerOpen(false);
                          }}
                          testID={`training-partner-${p.id}`}
                        >
                          <Text style={[styles.partnerName, partnerId === p.id && styles.chipTextActive]}>{p.name}</Text>
                          {partnerId === p.id ? <Lucide name="check" size={14} color={colors.primaryMid} /> : null}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Optional note */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{s('trainingNoteLabel')}</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                placeholder={s('trainingNotePlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={note}
                onChangeText={setNote}
                maxLength={280}
                multiline
                testID="training-note"
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                <Text style={styles.cancelText}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
                testID="training-save"
              >
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
      maxHeight: '88%',
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
    venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg },
    venueText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, flex: 1 },
    field: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: 6 },
    fieldLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textFaint, letterSpacing: 0.7 },
    input: {
      backgroundColor: colors.bg, borderRadius: 8, minHeight: 42, paddingHorizontal: 12, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.border, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text,
    },
    noteInput: { minHeight: 64, textAlignVertical: 'top' },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 4 },
    presets: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: 16,
      backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: 'transparent',
    },
    presetChip: {
      paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 16,
      backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: 'transparent',
    },
    chipActive: { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim },
    chipText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    chipTextActive: { color: colors.primaryMid, fontWeight: FontWeight.semibold },
    selectRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.bg, borderRadius: 8, height: 42, paddingHorizontal: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    selectText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text, flex: 1 },
    partnerList: { marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
    partnerItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
    },
    partnerName: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text },
    partnerEmpty: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textFaint, padding: 12 },
    actions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, height: 46, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textMuted },
    saveBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary, borderRadius: Radius.md, height: 46, gap: Spacing.xs, ...Shadows.md,
    },
    saveText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
  });
}
