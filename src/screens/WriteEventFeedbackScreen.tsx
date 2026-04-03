import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { supabase } from '../lib/supabase';
import { createEventFeedback, getUserEventFeedback } from '../services/eventFeedback';
import { safeErrorMessage } from '../lib/auth-utils';
import { hapticLight, hapticSuccess } from '../lib/haptics';

const HOUR_PRESETS = [1, 1.5, 2, 3];

interface Props {
  visible: boolean;
  eventId: number | null;
  onDismiss: () => void;
}

export function WriteEventFeedbackScreen({ visible, eventId, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [rating, setRating] = useState(4);
  const [hoursPlayed, setHoursPlayed] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (!visible || !eventId) return;
    let cancelled = false;

    // Reset form on open
    setRating(4);
    setHoursPlayed('');
    setReviewText('');
    setAlreadySubmitted(false);
    setEventTitle('');

    async function load() {
      const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('id', eventId)
        .single();
      if (!cancelled && event) setEventTitle(event.title);

      if (user) {
        const { data: existing } = await getUserEventFeedback(eventId!, user.id);
        if (!cancelled && existing) setAlreadySubmitted(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [visible, eventId, user]);

  const handleSubmit = useCallback(async () => {
    const hours = parseFloat(hoursPlayed);
    if (rating < 1 || isNaN(hours) || hours <= 0) {
      Alert.alert(s('error'), s('feedbackRequired'));
      return;
    }
    if (!user || !eventId) return;

    setLoading(true);
    const { error } = await createEventFeedback({
      event_id: eventId,
      user_id: user.id,
      reviewer_name: user?.user_metadata?.full_name || null,
      rating,
      hours_played: hours,
      body: reviewText.trim() || null,
    });
    setLoading(false);

    if (error) {
      Alert.alert(s('error'), safeErrorMessage(error, 'genericError', s));
      return;
    }

    hapticSuccess();
    Alert.alert(s('success'), s('feedbackSubmitted'));
    onDismiss();
  }, [rating, hoursPlayed, reviewText, user, eventId, onDismiss, s]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom }]} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{s('eventFeedbackTitle')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
              <Lucide name="x" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          </View>

          {/* Event Name */}
          <View style={styles.eventName}>
            <Lucide name="calendar" size={14} color={colors.textFaint} />
            <Text style={styles.eventNameText} numberOfLines={1}>{eventTitle || s('loading')}</Text>
          </View>

          {alreadySubmitted ? (
            <View style={styles.alreadySent}>
              <Lucide name="check-circle" size={24} color={colors.primaryLight} />
              <Text style={styles.alreadySentText}>{s('feedbackAlreadySent')}</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
                {/* Rating */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{s('fieldRating')}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        style={[styles.starBtn, star <= rating ? styles.starBtnActive : styles.starBtnInactive]}
                        onPress={() => { hapticLight(); setRating(star); }}
                      >
                        <Text style={[styles.starText, star <= rating ? styles.starTextActive : styles.starTextInactive]}>
                          {'\u2605'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Hours Played */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{s('hoursPlayed')}</Text>
                  <TextInput
                    style={styles.hoursInput}
                    placeholder={s('hoursPlayedPlaceholder')}
                    placeholderTextColor={colors.textFaint}
                    value={hoursPlayed}
                    onChangeText={setHoursPlayed}
                    keyboardType="decimal-pad"
                    maxLength={4}
                  />
                  <View style={styles.presetsRow}>
                    {HOUR_PRESETS.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.presetChip, hoursPlayed === String(h) && styles.presetChipActive]}
                        onPress={() => { hapticLight(); setHoursPlayed(String(h)); }}
                      >
                        <Text style={[styles.presetText, hoursPlayed === String(h) && styles.presetTextActive]}>
                          {h}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Review Text */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{s('feedbackReview')}</Text>
                  <TextInput
                    style={[styles.textarea, styles.textareaInput]}
                    placeholder="..."
                    placeholderTextColor={colors.textFaint}
                    value={reviewText}
                    onChangeText={setReviewText}
                    maxLength={2000}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              {/* Actions pinned at bottom */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                  <Text style={styles.cancelText}>{s('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.submitText}>{s('publish')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayHeavy,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
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
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: Spacing.sm,
    },
    sheetTitle: { fontFamily: Fonts.heading, fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: colors.text },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
    eventName: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 6 },
    eventNameText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted, flex: 1 },
    alreadySent: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    alreadySentText: { fontFamily: Fonts.body, fontSize: FontSize.lg, color: colors.textMuted },
    formScroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    field: { gap: 6, marginBottom: Spacing.md },
    fieldLabel: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textFaint, letterSpacing: 0.7 },
    starsRow: { flexDirection: 'row', gap: Spacing.xs },
    starBtn: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
    starBtnActive: { backgroundColor: colors.primary },
    starBtnInactive: { backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: colors.border },
    starText: { fontSize: FontSize.xl },
    starTextActive: { color: colors.textOnPrimary },
    starTextInactive: { color: colors.textFaint },
    hoursInput: {
      backgroundColor: colors.bg, borderRadius: 8, height: 42, paddingHorizontal: 12,
      borderWidth: 1, borderColor: colors.border, fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text,
    },
    presetsRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4 },
    presetChip: {
      paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 16,
      backgroundColor: colors.bgMuted, borderWidth: 1, borderColor: 'transparent',
    },
    presetChipActive: { backgroundColor: colors.primaryPale, borderColor: colors.primaryDim },
    presetText: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.textMuted },
    presetTextActive: { color: colors.primaryMid, fontWeight: FontWeight.semibold },
    textarea: { backgroundColor: colors.bg, borderRadius: 8, height: 80, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
    textareaInput: { fontFamily: Fonts.body, fontSize: FontSize.md, color: colors.text, textAlignVertical: 'top' },
    actions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, paddingHorizontal: Spacing.lg },
    cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, height: 46, borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textMuted },
    submitBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary, borderRadius: Radius.md, height: 46, gap: Spacing.xs, ...Shadows.md,
    },
    submitText: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
  });
}
