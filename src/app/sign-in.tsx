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
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { Lucide } from '../components/Icon';
import { Colors } from '../theme';
import { styles } from './sign-in.styles';
import { logger } from '../lib/logger';
import { isValidEmail, mapAuthErrorToKey } from '../lib/auth-utils';

const TERMS_URL = 'https://ttportal.ro/terms';
const PRIVACY_URL = 'https://ttportal.ro/privacy';

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
  const { signUp, signIn, signInWithGoogle, signInWithApple } = useSession();
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
      const isLogin = activeTab === 'login';
      logger.track(isLogin ? 'login_submit' : 'signup_submit', { email });
      const { error: authError } = isLogin
        ? await signIn(email, password)
        : await signUp(fullName, email, password);
      if (authError) {
        logger.warn(isLogin ? 'login failed' : 'signup failed', {
          code: authError.code,
        });
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      logger.info(isLogin ? 'login success' : 'signup success', { email });
      router.replace(returnTo || '/(tabs)/');
    } catch (err) {
      logger.error(activeTab === 'login' ? 'login exception' : 'signup exception', err);
      setError(s('errorNetwork'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, fullName, email, password, signUp, signIn, s, router, returnTo]);

  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      logger.track('google_signin_submit');
      const { error: authError } = await signInWithGoogle();
      if (authError) {
        logger.warn('Google sign-in failed', { code: authError.code });
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      logger.info('Google sign-in success');
      router.replace(returnTo || '/(tabs)/');
    } catch (err) {
      logger.error('Google sign-in exception', err);
      setError(s('errorNetwork'));
    } finally {
      setLoading(false);
    }
  }, [signInWithGoogle, s, router, returnTo]);

  const handleAppleSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      logger.track('apple_signin_submit');
      const { error: authError } = await signInWithApple();
      if (authError) {
        logger.warn('Apple sign-in failed', { code: authError.code });
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      logger.info('Apple sign-in success');
      router.replace(returnTo || '/(tabs)/');
    } catch (err) {
      logger.error('Apple sign-in exception', err);
      setError(s('errorNetwork'));
    } finally {
      setLoading(false);
    }
  }, [signInWithApple, s, router, returnTo]);

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

            {/* Terms and Privacy links (signup only) */}
            {activeTab === 'signup' && (
              <Text style={styles.termsText} testID="terms-container">
                {s('authTermsPrefix')}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL(TERMS_URL)}
                  accessibilityRole="link"
                  testID="terms-link"
                >
                  {s('authTermsOfServiceLink')}
                </Text>
                {s('authTermsConnector')}
                <Text
                  style={styles.termsLink}
                  onPress={() => Linking.openURL(PRIVACY_URL)}
                  accessibilityRole="link"
                  testID="privacy-link"
                >
                  {s('authPrivacyPolicyLink')}
                </Text>
              </Text>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {s('authOrContinueWith')}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              <Pressable
                style={[styles.googleBtn, loading && styles.socialBtnDisabled]}
                accessibilityRole="button"
                onPress={handleGoogleSignIn}
                disabled={loading}
                testID="google-button"
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Google</Text>
              </Pressable>
              <Pressable
                style={[styles.appleBtn, loading && styles.socialBtnDisabled]}
                accessibilityRole="button"
                onPress={handleAppleSignIn}
                disabled={loading}
                testID="apple-button"
              >
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
