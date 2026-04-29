import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius, Shadows } from '../theme';
import { Lucide } from '../components/Icon';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { isStrongPassword } from '../lib/auth-utils';

type TokenStatus = 'loading' | 'valid' | 'expired' | 'used';

interface RecoveryParams {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  errorDescription?: string;
}

function readRecoveryParams(rawParams: Record<string, string | string[] | undefined>): RecoveryParams {
  const getValue = (key: string) => {
    const value = rawParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    code: getValue('code'),
    accessToken: getValue('access_token'),
    refreshToken: getValue('refresh_token'),
    errorDescription: getValue('error_description'),
  };
}

function readRecoveryParamsFromUrl(url: string): RecoveryParams {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const fragment = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;

  return {
    code: typeof query.code === 'string' ? query.code : undefined,
    accessToken:
      typeof query.access_token === 'string'
        ? query.access_token
        : (fragment?.get('access_token') ?? undefined),
    refreshToken:
      typeof query.refresh_token === 'string'
        ? query.refresh_token
        : (fragment?.get('refresh_token') ?? undefined),
    errorDescription:
      typeof query.error_description === 'string'
        ? query.error_description
        : (fragment?.get('error_description') ?? undefined),
  };
}

function isUsedTokenMessage(message?: string): boolean {
  return message?.toLowerCase().includes('already') === true;
}

/**
 * Reset password screen — allows users to set a new password after
 * clicking the reset link from their email. Handles expired and
 * already-used tokens with appropriate error messages.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapRecoverySession() {
      const directParams = readRecoveryParams(params);
      const initialUrl = await Linking.getInitialURL();
      const urlParams = initialUrl ? readRecoveryParamsFromUrl(initialUrl) : {};
      const recovery = {
        ...urlParams,
        ...Object.fromEntries(
          Object.entries(directParams).filter(([, value]) => value !== undefined),
        ),
      };

      if (recovery.errorDescription) {
        setTokenStatus(isUsedTokenMessage(recovery.errorDescription) ? 'used' : 'expired');
        return;
      }

      if (recovery.accessToken && recovery.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: recovery.accessToken,
          refresh_token: recovery.refreshToken,
        });

        if (cancelled) return;

        if (sessionError) {
          logger.warn('reset password session bootstrap failed', {
            error: sessionError.message,
          });
          setTokenStatus(isUsedTokenMessage(sessionError.message) ? 'used' : 'expired');
          return;
        }

        logger.info('reset password session restored from tokens');
        setTokenStatus('valid');
        return;
      }

      if (!recovery.code) {
        setTokenStatus('expired');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(recovery.code);

      if (cancelled) return;

      if (exchangeError) {
        logger.warn('reset password token exchange failed', {
          error: exchangeError.message,
        });
        setTokenStatus(isUsedTokenMessage(exchangeError.message) ? 'used' : 'expired');
        return;
      }

      logger.info('reset password token verified');
      setTokenStatus('valid');
    }

    void bootstrapRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const handleSubmit = useCallback(async () => {
    if (!isStrongPassword(newPassword)) {
      setError(s('validationPasswordStrength'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      logger.track('reset_password_submit');
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        logger.error('reset password failed', updateError);
        setError(s('errorNetwork'));
        return;
      }

      logger.info('password reset successful');
      setSuccess(true);
      router.replace({ pathname: '/sign-in', params: { initialTab: 'login' } });
    } catch (err) {
      logger.error('reset password exception', err);
      setError(s('errorNetwork'));
    } finally {
      setLoading(false);
    }
  }, [newPassword, s, router]);

  const handleRequestNewLink = useCallback(() => {
    router.replace('/forgot-password');
  }, [router]);

  if (tokenStatus === 'loading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator
          size="large"
          color={colors.textOnPrimary}
          testID="token-loading"
        />
      </View>
    );
  }

  if (tokenStatus === 'expired') {
    return (
      <View style={[styles.container, styles.centered]} testID="token-expired">
        <Lucide name="alert-circle" size={48} color={colors.red} />
        <Text style={styles.errorTitle}>{s('resetPasswordExpired')}</Text>
        <Pressable
          onPress={handleRequestNewLink}
          accessibilityRole="button"
          testID="request-new-link"
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>{s('resetPasswordRequestNew')}</Text>
        </Pressable>
      </View>
    );
  }

  if (tokenStatus === 'used') {
    return (
      <View style={[styles.container, styles.centered]} testID="token-used">
        <Lucide name="alert-circle" size={48} color={colors.red} />
        <Text style={styles.errorTitle}>{s('resetPasswordUsed')}</Text>
        <Pressable
          onPress={handleRequestNewLink}
          accessibilityRole="button"
          testID="request-new-link"
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>{s('resetPasswordRequestNew')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View testID="reset-password-screen">
          <View style={styles.iconContainer}>
            <Lucide name="key-round" size={48} color={colors.textOnPrimary} />
          </View>

          <Text style={styles.title}>{s('authResetPasswordTitle')}</Text>

          {success ? (
            <Text style={styles.successText} testID="success-message">
              {s('resetPasswordSuccess')}
            </Text>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputRow}>
                <Lucide name="lock" size={18} color={colors.textFaint} />
                <TextInput
                  placeholder={s('authNewPassword')}
                  placeholderTextColor={colors.textFaint}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  accessibilityLabel={s('authNewPassword')}
                  secureTextEntry
                  style={styles.textInput}
                  testID="input-new-password"
                />
              </View>

              {error && (
                <Text
                  accessibilityRole="alert"
                  testID="error-message"
                  style={styles.errorText}
                >
                  {error}
                </Text>
              )}

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
                    color={colors.textOnPrimary}
                    testID="loading-spinner"
                  />
                ) : (
                  <Text style={styles.submitText}>
                    {s('resetPasswordConfirmBtn')}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
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
      color: colors.textOnPrimary,
      textAlign: 'center',
      marginBottom: 24,
    },
    form: {
      gap: 14,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.authInputBg,
      borderRadius: Radius.md,
      height: 48,
      paddingHorizontal: 14,
      gap: 10,
      ...Shadows.sm,
    },
    textInput: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.textOnPrimary,
      height: 48,
      paddingVertical: 0,
    },
    errorText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.red,
      textAlign: 'center',
    },
    errorTitle: {
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.textOnPrimary,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 20,
      lineHeight: 22,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      height: 50,
      gap: 8,
      ...Shadows.md,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      fontFamily: Fonts.body,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    successText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.primaryDim,
      textAlign: 'center',
      lineHeight: 22,
    },
    linkBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    linkText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      color: colors.primaryDim,
      textDecorationLine: 'underline',
    },
  });
}
