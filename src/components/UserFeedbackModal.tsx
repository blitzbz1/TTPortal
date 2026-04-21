import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { usePathname } from 'expo-router';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { submitUserFeedback, type UserFeedbackCategory } from '../services/userFeedback';

const MESSAGE_MAX = 2000;
const FEATURE_TITLE_MAX = 100;

interface CategoryOption {
  key: UserFeedbackCategory;
  icon: string;
  labelKey: string;
}

const CATEGORIES: readonly CategoryOption[] = [
  { key: 'bug', icon: 'bug', labelKey: 'feedbackCategoryBug' },
  { key: 'feature', icon: 'lightbulb', labelKey: 'feedbackCategoryFeature' },
  { key: 'general', icon: 'message-square', labelKey: 'feedbackCategoryGeneral' },
];

interface UserFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

export function UserFeedbackModal({ visible, onClose }: UserFeedbackModalProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const { user } = useSession();
  const pathname = usePathname();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [category, setCategory] = useState<UserFeedbackCategory>('general');
  const [featureTitle, setFeatureTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCategory('general');
    setFeatureTitle('');
    setMessage('');
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(async () => {
    if (!user) return;
    const trimmed = message.trim();
    if (!trimmed) {
      setError(s('feedbackErrorMessageRequired'));
      return;
    }
    if (category === 'feature' && !featureTitle.trim()) {
      setError(s('feedbackErrorFeatureTitleRequired'));
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: submitError } = await submitUserFeedback({
      userId: user.id,
      userEmail: user.email ?? null,
      page: pathname || 'unknown',
      category,
      message: trimmed,
      featureTitle: category === 'feature' ? featureTitle.trim() : undefined,
    });
    setSubmitting(false);
    if (submitError) {
      setError(s('feedbackErrorGeneric'));
      return;
    }
    setSubmitted(true);
  }, [user, message, category, featureTitle, pathname, s]);

  if (!visible) return null;

  const canSubmit =
    !submitting &&
    message.trim().length > 0 &&
    (category !== 'feature' || featureTitle.trim().length > 0);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <View style={styles.headerRow}>
              <Text style={styles.title}>{s('feedbackTitle')}</Text>
              <TouchableOpacity
                onPress={handleClose}
                accessibilityLabel={s('close')}
                testID="feedback-close"
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Lucide name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.successWrap} testID="feedback-success">
                <View style={styles.successIcon}>
                  <Lucide name="check" size={28} color={colors.textOnPrimary} />
                </View>
                <Text style={styles.successTitle}>{s('feedbackSuccessTitle')}</Text>
                <Text style={styles.successBody}>{s('feedbackSuccessBody')}</Text>
                <TouchableOpacity
                  style={[styles.submitBtn, styles.successBtn]}
                  onPress={handleClose}
                  testID="feedback-done"
                >
                  <Text style={styles.submitBtnText}>{s('feedbackDone')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.description}>{s('feedbackDescription')}</Text>

                <View style={styles.categoryRow}>
                  {CATEGORIES.map((opt) => {
                    const active = opt.key === category;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                        onPress={() => setCategory(opt.key)}
                        testID={`feedback-category-${opt.key}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Lucide
                          name={opt.icon}
                          size={16}
                          color={active ? colors.primary : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.categoryLabel,
                            active && styles.categoryLabelActive,
                          ]}
                        >
                          {s(opt.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {category === 'feature' && (
                  <TextInput
                    style={styles.titleInput}
                    value={featureTitle}
                    onChangeText={(v) => {
                      setFeatureTitle(v);
                      if (error) setError(null);
                    }}
                    placeholder={s('feedbackFeatureTitlePh')}
                    placeholderTextColor={colors.textFaint}
                    maxLength={FEATURE_TITLE_MAX}
                    editable={!submitting}
                    testID="feedback-feature-title"
                  />
                )}

                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={(v) => {
                    setMessage(v);
                    if (error) setError(null);
                  }}
                  placeholder={s('feedbackMessagePh')}
                  placeholderTextColor={colors.textFaint}
                  multiline
                  maxLength={MESSAGE_MAX}
                  editable={!submitting}
                  testID="feedback-message"
                />

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  testID="feedback-submit"
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator color={colors.textOnPrimary} />
                      <Text style={styles.submitBtnText}>{s('feedbackSending')}</Text>
                    </>
                  ) : (
                    <Text style={styles.submitBtnText}>{s('feedbackSubmit')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
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
    },
    kav: {
      width: '100%',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xxl,
      width: '100%',
      ...Shadows.lg,
    },
    handleWrap: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    description: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      marginBottom: Spacing.md,
    },
    categoryRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginBottom: Spacing.md,
    },
    categoryChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xs,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    categoryChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryPale,
    },
    categoryLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
    },
    categoryLabelActive: {
      color: colors.primary,
      fontWeight: FontWeight.semibold,
    },
    titleInput: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    messageInput: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: Spacing.sm,
    },
    errorText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.red,
      marginBottom: Spacing.sm,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      marginTop: Spacing.xs,
      ...Shadows.md,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    successWrap: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    successBtn: {
      alignSelf: 'stretch',
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
      ...Shadows.md,
    },
    successTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: 4,
    },
    successBody: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
  });
}
