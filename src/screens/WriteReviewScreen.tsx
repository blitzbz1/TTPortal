import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getVenueById } from '../services/venues';
import { createReview } from '../services/reviews';
import { safeErrorMessage } from '../lib/auth-utils';
import { hapticLight } from '../lib/haptics';

interface Props {
  venueId?: string;
}

// Static list — hoisted so it isn't rebuilt every render and so the memoized
// TagsRow below sees identity-stable input.
const TAG_KEYS = [
  { key: 'goodTables', label: 'tagGoodTables' },
  { key: 'newPaddles', label: 'tagNewPaddles' },
  { key: 'goodLighting', label: 'tagGoodLighting' },
  { key: 'crowded', label: 'tagCrowded' },
  { key: 'quiet', label: 'tagQuiet' },
  { key: 'friendlyStaff', label: 'tagFriendlyStaff' },
  { key: 'clean', label: 'tagClean' },
  { key: 'nearbyParking', label: 'tagParking' },
] as const;

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

interface TagsRowProps {
  selected: string[];
  onToggle: (key: string) => void;
  s: (key: string) => string;
  styles: ReturnType<typeof createStyles>;
}
const TagsRow = React.memo(function TagsRow({ selected, onToggle, s, styles }: TagsRowProps) {
  return (
    <View style={styles.tagsRow}>
      {TAG_KEYS.map((t) => {
        const isSelected = selected.includes(t.key);
        return (
          <TouchableOpacity
            key={t.key}
            testID={`tag-${t.key}`}
            style={[styles.tagPill, isSelected && styles.tagPillSelected]}
            onPress={() => onToggle(t.key)}
          >
            <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{s(t.label)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

export function WriteReviewScreen({ venueId }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rating, setRating] = useState(4);
  const [reviewText, setReviewText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [venueName, setVenueName] = useState('');
  const [loading, setLoading] = useState(false);

  const onStarPress = useCallback((star: number) => {
    hapticLight();
    setRating(star);
  }, []);

  useEffect(() => {
    if (!venueId || isNaN(Number(venueId)) || Number(venueId) < 1) return;
    let cancelled = false;
    async function load() {
      const { data } = await getVenueById(Number(venueId));
      if (!cancelled && data) setVenueName(data.name);
    }
    load();
    return () => { cancelled = true; };
  }, [venueId]);

  const toggleTag = useCallback((key: string) => {
    hapticLight();
    setTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating < 1) { Alert.alert(s('error'), s('selectRating')); return; }
    if (!reviewText.trim()) { Alert.alert(s('error'), s('writeReviewRequired')); return; }
    if (!user || !venueId) return;
    setLoading(true);
    let body = reviewText.trim();
    if (tags.length > 0) {
      body += `\n\n\u{1F3F7}\uFE0F tags: ${tags.join(', ')}`;
    }
    const { error } = await createReview({
      venue_id: Number(venueId),
      user_id: user.id,
      reviewer_name: user?.user_metadata?.full_name || s('anon'),
      rating,
      body,
    });
    setLoading(false);
    if (error) { Alert.alert(s('error'), safeErrorMessage(error, 'genericError', s)); return; }
    Alert.alert(s('success'), s('reviewPublished'));
    router.back();
  }, [rating, reviewText, tags, user, venueId, router, s]);

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
            <StarsRow rating={rating} onPress={onStarPress} styles={styles} />
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{s('fieldTags')}</Text>
            <TagsRow selected={tags} onToggle={toggleTag} s={s} styles={styles} />
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
              maxLength={2000}
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
      ...Shadows.lg,
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
      paddingBottom: Spacing.sm,
    },
    sheetTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
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
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    formScroll: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    field: {
      gap: 6,
      marginBottom: Spacing.md,
    },
    fieldLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
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
      ...Shadows.sm,
    },
    inputPlaceholder: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
    },
    inputValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
    },
    starsRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    starBtn: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
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
      fontSize: FontSize.xxxl,
    },
    starTextActive: {
      color: colors.textOnPrimary,
    },
    starTextInactive: {
      color: colors.textFaint,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    tagPill: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tagPillSelected: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primaryDim,
    },
    tagText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
    },
    tagTextSelected: {
      color: colors.primaryMid,
      fontWeight: FontWeight.semibold,
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
      fontSize: FontSize.md,
      color: colors.text,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
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
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
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
      gap: Spacing.xs,
      ...Shadows.md,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
  });
}
