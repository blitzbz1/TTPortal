import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getVenueById } from '../services/venues';
import { createReview } from '../services/reviews';

interface Props {
  venueId?: string;
}

export function WriteReviewScreen({ venueId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rating, setRating] = useState(4);
  const [reviewText, setReviewText] = useState('');
  const [venueName, setVenueName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    async function load() {
      const { data } = await getVenueById(Number(venueId));
      if (!cancelled && data) setVenueName(data.name);
    }
    load();
    return () => { cancelled = true; };
  }, [venueId]);

  const handleSubmit = useCallback(async () => {
    if (rating < 1) { Alert.alert(s('error'), s('selectRating')); return; }
    if (!reviewText.trim()) { Alert.alert(s('error'), s('writeReviewRequired')); return; }
    if (!user || !venueId) return;
    setLoading(true);
    const { error } = await createReview({
      venue_id: Number(venueId),
      user_id: user.id,
      reviewer_name: user?.user_metadata?.full_name || s('anon'),
      rating,
      body: reviewText.trim(),
      flagged: false,
      flag_count: 0,
    });
    setLoading(false);
    if (error) { Alert.alert(s('error'), error.message); return; }
    Alert.alert(s('success'), s('reviewPublished'));
    router.back();
  }, [rating, reviewText, user, venueId, router]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Dim background */}
      <View style={styles.dimBg} />

      {/* Review Sheet */}
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{s('writeReviewTitle')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Lucide name="x" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        </View>

        {/* Venue Name */}
        <View style={styles.venueName}>
          <Lucide name="map-pin" size={14} color={colors.textFaint} />
          <Text style={styles.venueNameText}>{venueName || s('loading')}</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldYourName')}</Text>
            <View style={styles.input}>
              <Text style={styles.inputValue}>{user?.user_metadata?.full_name || s('anon')}</Text>
            </View>
          </View>

          {/* Rating */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldRating')}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  style={[styles.starBtn, star <= rating ? styles.starBtnActive : styles.starBtnInactive]}
                  onPress={() => setRating(star)}
                >
                  <Text style={[styles.starText, star <= rating ? styles.starTextActive : styles.starTextInactive]}>
                    {'\u2605'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Review Text */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldYourReview')}</Text>
            <TextInput
              style={[styles.textarea, styles.textareaInput]}
              placeholder={s('reviewPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelText}>{s('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Lucide name="send" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.submitText}>{s('publish')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    dimBg: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 464,
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.08,
      shadowRadius: 32,
      elevation: 10,
    },
    handleWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 100,
      backgroundColor: colors.border,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    sheetTitle: {
      fontFamily: Fonts.heading,
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    venueName: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 6,
    },
    venueNameText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textMuted,
    },
    formScroll: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    field: {
      gap: 6,
      marginBottom: 16,
    },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textFaint,
      letterSpacing: 0.7,
    },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderRadius: 8,
      height: 42,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputPlaceholder: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textFaint,
    },
    inputValue: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.text,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    starBtn: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starBtnActive: {
      backgroundColor: colors.primary,
    },
    starBtnInactive: {
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    starText: {
      fontSize: 20,
    },
    starTextActive: {
      color: colors.textOnPrimary,
    },
    starTextInactive: {
      color: colors.textFaint,
    },
    textarea: {
      backgroundColor: colors.bg,
      borderRadius: 8,
      height: 90,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textareaInput: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.text,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 8,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    submitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      height: 46,
      gap: 8,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
  });
}
