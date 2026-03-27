import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { isValidEmail } from '../lib/auth-utils';
import { logger } from '../lib/logger';

const INPUT_BG = '#0f3d22';

/**
 * Forgot password screen — allows users to request a password reset email.
 * Shows identical success message for existing and non-existing emails
 * to prevent user enumeration (FR-007).
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useSession();
  const { s } = useI18n();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!isValidEmail(email)) {
      setError(s('validationEmailInvalid'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      logger.track('forgot_password_submit', { email });
      await resetPassword(email);
      logger.info('forgot password email sent', { email });
      setSent(true);
    } catch {
      logger.warn('forgot password request failed', { email });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }, [email, resetPassword, s]);

  const handleBackToLogin = useCallback(() => {
    router.replace({ pathname: '/sign-in', params: { initialTab: 'login' } });
  }, [router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View testID="forgot-password-screen">
          {/* Lock icon */}
          <View style={styles.iconContainer}>
            <Lucide name="lock" size={48} color={Colors.white} />
          </View>

          <Text style={styles.title}>{s('authResetPasswordTitle')}</Text>

          {sent ? (
            <View testID="success-container">
              <Text style={styles.successText} testID="success-message">
                {s('forgotPasswordSuccess')}
              </Text>
              <Pressable
                onPress={handleBackToLogin}
                accessibilityRole="button"
                testID="back-to-login"
                style={styles.backLink}
              >
                <Lucide name="arrow-left" size={16} color={Colors.greenDim} />
                <Text style={styles.backLinkText}>
                  {s('authBackToLogin')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Email input */}
              <View style={styles.inputRow}>
                <Lucide name="mail" size={18} color={Colors.inkFaint} />
                <TextInput
                  placeholder={s('authEmail')}
                  placeholderTextColor={Colors.inkFaint}
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel={s('authEmail')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  style={styles.textInput}
                  testID="input-email"
                />
              </View>

              {/* Error message */}
              {error && (
                <Text
                  accessibilityRole="alert"
                  testID="error-message"
                  style={styles.errorText}
                >
                  {error}
                </Text>
              )}

              {/* Submit button */}
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                accessibilityRole="button"
                testID="submit-button"
                style={[
                  styles.submitBtn,
                  loading && styles.submitBtnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={Colors.white}
                    testID="loading-spinner"
                  />
                ) : (
                  <Text style={styles.submitText}>
                    {s('authSendResetLink')}
                  </Text>
                )}
              </Pressable>

              {/* Back to login link */}
              <Pressable
                onPress={handleBackToLogin}
                accessibilityRole="button"
                testID="back-to-login"
                style={styles.backLink}
              >
                <Lucide name="arrow-left" size={16} color={Colors.greenDim} />
                <Text style={styles.backLinkText}>
                  {s('authBackToLogin')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.green,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 28,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 24,
  },
  form: {
    gap: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.white,
    height: 48,
    paddingVertical: 0,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenLight,
    borderRadius: 12,
    height: 50,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  successText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.greenDim,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  backLinkText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.greenDim,
  },
});
