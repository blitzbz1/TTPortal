import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { logger } from '../lib/logger';
import type { AuthError } from '@supabase/supabase-js';

/** Validates email format using basic RFC 5322 pattern. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Maps a Supabase AuthError to an i18n error key. */
function mapAuthErrorToKey(error: AuthError): string {
  if (
    error.code === 'user_already_exists' ||
    error.message?.includes('already registered')
  ) {
    return 'errorDuplicateEmail';
  }
  if (
    error.name === 'AuthRetryableFetchError' ||
    error.message?.includes('Failed to fetch')
  ) {
    return 'errorNetwork';
  }
  return 'errorNetwork';
}

/**
 * Auth screen with signup/login tabs, email/password form,
 * client-side validation, and OAuth buttons (placeholder).
 * Uses design system colors (dark green background) and i18n strings.
 */
export default function SignInScreen() {
  const { returnTo, initialTab } = useLocalSearchParams<{
    returnTo?: string;
    initialTab?: 'signup' | 'login';
  }>();
  const router = useRouter();
  const { signUp } = useSession();
  const { s } = useI18n();

  const [activeTab, setActiveTab] = useState<'signup' | 'login'>(
    (initialTab as 'signup' | 'login') || 'signup',
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTabSwitch = useCallback(
    (tab: 'signup' | 'login') => {
      setActiveTab(tab);
      setError(null);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (activeTab === 'signup' && !fullName.trim()) {
      setError(s('validationNameRequired'));
      return;
    }
    if (!isValidEmail(email)) {
      setError(s('validationEmailInvalid'));
      return;
    }
    if (password.length < 8) {
      setError(s('validationPasswordMin'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      logger.track('signup_submit', { email });
      const { error: authError } = await signUp(fullName, email, password);
      if (authError) {
        logger.warn('signup failed', { code: authError.code });
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      logger.info('signup success', { email });
      router.replace(returnTo || '/(tabs)/');
    } catch (err) {
      logger.error('signup exception', err);
      setError(s('errorNetwork'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, fullName, email, password, signUp, s, router, returnTo]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View testID="sign-in-screen">
          {/* Branding */}
          <View style={styles.branding}>
            <Text style={styles.brandSubtitle}>Mese Tenis Rom&#226;nia</Text>
            <Text style={styles.brandLogo}>TT PORTAL</Text>
            <Text style={styles.brandTagline}>
              {s('splashSub')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Tabs */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => handleTabSwitch('signup')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'signup' }}
                testID="tab-signup"
                style={[
                  styles.tab,
                  activeTab === 'signup' && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'signup' && styles.tabTextActive,
                  ]}
                >
                  {s('authSignup')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleTabSwitch('login')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'login' }}
                testID="tab-login"
                style={[
                  styles.tab,
                  activeTab === 'login' && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'login' && styles.tabTextActive,
                  ]}
                >
                  {s('authLogin')}
                </Text>
              </Pressable>
            </View>

            {/* Name field (signup only) */}
            {activeTab === 'signup' && (
              <View style={styles.inputRow}>
                <Lucide name="user" size={18} color={Colors.inkFaint} />
                <TextInput
                  placeholder={s('authFullName')}
                  placeholderTextColor={Colors.inkFaint}
                  value={fullName}
                  onChangeText={setFullName}
                  accessibilityLabel={s('authFullName')}
                  style={styles.textInput}
                  testID="input-name"
                />
              </View>
            )}

            {/* Email field */}
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

            {/* Password field */}
            <View style={styles.inputRow}>
              <Lucide name="lock" size={18} color={Colors.inkFaint} />
              <TextInput
                placeholder={s('authPassword')}
                placeholderTextColor={Colors.inkFaint}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                accessibilityLabel={s('authPassword')}
                autoCapitalize="none"
                style={[styles.textInput, { flex: 1 }]}
                testID="input-password"
              />
              <Pressable
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityLabel="toggle-password-visibility"
                hitSlop={8}
                testID="toggle-password"
              >
                <Lucide
                  name={passwordVisible ? 'eye' : 'eye-off'}
                  size={18}
                  color={Colors.inkFaint}
                />
              </Pressable>
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
              accessibilityLabel={s('authSubmitSignup')}
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
                <>
                  <Text style={styles.submitText}>
                    {activeTab === 'signup'
                      ? s('authSubmitSignup')
                      : s('authSubmitLogin')}
                  </Text>
                  <Lucide name="arrow-right" size={20} color={Colors.white} />
                </>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {s('authOrContinueWith')}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons (placeholder — US3/US4 will wire these) */}
            <View style={styles.socialRow}>
              <Pressable style={styles.googleBtn} accessibilityRole="button">
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Google</Text>
              </Pressable>
              <Pressable style={styles.appleBtn} accessibilityRole="button">
                <Lucide name="apple" size={20} color={Colors.white} />
                <Text style={styles.appleText}>Apple</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const INPUT_BG = '#0f3d22';

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
  branding: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  brandSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.greenDim,
    opacity: 0.7,
  },
  brandLogo: {
    fontFamily: Fonts.heading,
    fontSize: 42,
    fontWeight: '800',
    color: Colors.white,
  },
  brandTagline: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.greenDim,
    textAlign: 'center',
    maxWidth: 260,
  },
  form: {
    gap: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: INPUT_BG,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: Colors.white,
  },
  tabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.greenDim,
  },
  tabTextActive: {
    color: Colors.green,
    fontWeight: '600',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: INPUT_BG,
  },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  googleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    height: 46,
    gap: 8,
  },
  googleIcon: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.green,
  },
  googleText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.green,
  },
  appleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    height: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  appleText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});
