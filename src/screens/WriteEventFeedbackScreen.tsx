import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
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

interface Props {
  visible: boolean;
  eventId: number | null;
  onDismiss: () => void;
}

interface StarsRowProps {
  rating: number;
  onPress: (n: number) => void;
  styles: ReturnType<typeof createStyles>;
}
const StarsRow = React.memo(function StarsRow({ rating, onPress, styles }: StarsRowProps) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          style={[styles.starBtn, star <= rating ? styles.starBtnActive : styles.starBtnInactive]}
          onPress={() => onPress(star)}
        >
          <Text style={[styles.starText, star <= rating ? styles.starTextActive : styles.starTextInactive]}>
            {'★'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

export function WriteEventFeedbackScreen({ visible, eventId, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [rating, setRating] = useState(4);
  const [reviewText, setReviewText] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const onStarPress = useCallback((star: number) => {
    hapticLight();
    setRating(star);
  }, []);

  useEffect(() => {
    if (!visible || !eventId) return;
    let cancelled = false;

    setRating(4);
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
    if (rating < 1) {
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
  }, [rating, reviewText, user, eventId, onDismiss, s]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom }]} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{s('eventFeedbackTitle')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
              <Lucide name="x" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          </View>

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
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{s('fieldRating')}</Text>
                  <StarsRow rating={rating} onPress={onStarPress} styles={styles} />
                </View>

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
      </KeyboardAvoidingView>
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
