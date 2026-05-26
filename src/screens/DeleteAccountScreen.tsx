import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { requestAccountDeletion } from '../services/account';
import { logger } from '../lib/logger';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isReady = confirmation.trim().toUpperCase() === CONFIRM_WORD;

  const performDelete = useCallback(async () => {
    setSubmitting(true);
    const { data, error } = await requestAccountDeletion();
    if (error) {
      logger.warn('request_account_deletion failed', { code: error.code, message: error.message });
      setSubmitting(false);
      const message = s('deleteAccountError');
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert(s('error'), message);
      return;
    }
    logger.info('account deletion requested', { hard_delete_at: data });
    await signOut();
    router.replace('/sign-in' as any);
  }, [router, s, signOut]);

  const handleSubmit = useCallback(() => {
    if (!isReady || submitting) return;

    const title = s('deleteAccountConfirmTitle');
    const message = s('deleteAccountConfirmBody');

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        void performDelete();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: s('cancel'), style: 'cancel' },
      { text: s('deleteAccountButton'), style: 'destructive', onPress: () => void performDelete() },
    ]);
  }, [isReady, submitting, s, performDelete]);

  const bullets: { icon: Parameters<typeof Lucide>[0]['name']; key: string }[] = [
    { icon: 'user', key: 'deleteAccountWhatProfile' },
    { icon: 'message-square', key: 'deleteAccountWhatReviews' },
    { icon: 'check-square', key: 'deleteAccountWhatCheckins' },
    { icon: 'calendar', key: 'deleteAccountWhatEvents' },
    { icon: 'users', key: 'deleteAccountWhatFriends' },
    { icon: 'image', key: 'deleteAccountWhatPhotos' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          testID="delete-account-back"
        >
          <Lucide name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{s('deleteAccountTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroIcon}>
          <Lucide name="alert-triangle" size={28} color={colors.redDeep} />
        </View>

        <Text style={styles.heroTitle}>{s('deleteAccountHeroTitle')}</Text>
        <Text style={styles.heroBody}>{s('deleteAccountHeroBody')}</Text>

        <View style={styles.bulletsCard}>
          <Text style={styles.bulletsHeader}>{s('deleteAccountWhatHeader')}</Text>
          {bullets.map(({ icon, key }) => (
            <View key={key} style={styles.bulletRow}>
              <View style={styles.bulletIcon}>
                <Lucide name={icon} size={16} color={colors.textMuted} />
              </View>
              <Text style={styles.bulletText}>{s(key)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.graceCard}>
          <Lucide name="clock" size={18} color={colors.textMuted} />
          <Text style={styles.graceText}>{s('deleteAccountGracePeriod')}</Text>
        </View>

        <Text style={styles.confirmLabel}>{s('deleteAccountConfirmLabel')}</Text>
        <TextInput
          style={styles.confirmInput}
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={colors.textFaint}
          testID="delete-account-confirm-input"
          accessibilityLabel={s('deleteAccountConfirmLabel')}
        />

        <Pressable
          onPress={handleSubmit}
          disabled={!isReady || submitting}
          accessibilityRole="button"
          testID="delete-account-submit"
          style={[styles.submitBtn, (!isReady || submitting) && styles.submitBtnDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} testID="delete-account-loading" />
          ) : (
            <Text style={styles.submitText}>{s('deleteAccountButton')}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          testID="delete-account-cancel"
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelText}>{s('cancel')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.redPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    heroTitle: {
      fontFamily: Fonts.heading,
      fontSize: 22,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: 8,
    },
    heroBody: {
      fontFamily: Fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      marginBottom: Spacing.lg,
    },
    bulletsCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: 12,
      marginBottom: Spacing.md,
    },
    bulletsHeader: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bulletIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bulletText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.text,
    },
    graceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bgMuted,
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    graceText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
    confirmLabel: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
      marginBottom: 8,
    },
    confirmInput: {
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      height: 48,
      fontFamily: Fonts.body,
      fontSize: 16,
      color: colors.text,
      letterSpacing: 2,
      marginBottom: Spacing.lg,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.redDeep,
      borderRadius: 12,
      height: 50,
      marginBottom: Spacing.sm,
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
    cancelBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    cancelText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.textMuted,
    },
  });
}
