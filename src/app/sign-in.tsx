import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { logger } from '../lib/logger';
import { isValidEmail, mapAuthErrorToKey } from '../lib/auth-utils';

const TERMS_URL = 'https://ttportal.ro/terms';
const PRIVACY_URL = 'https://ttportal.ro/privacy';
const INPUT_BG = '#0f3d22';

export default function SignInScreen() {
  const { returnTo, initialTab } = useLocalSearchParams<{
    returnTo?: string;
    initialTab?: 'signup' | 'login';
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, signIn, signInWithGoogle, signInWithApple } = useSession();
  const { s, lang, setLang } = useI18n();

  const [activeTab, setActiveTab] = useState<'signup' | 'login'>(
    (initialTab as 'signup' | 'login') || 'login',
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
      router.replace((returnTo || '/(tabs)') as any);
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
      router.replace((returnTo || '/(tabs)') as any);
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
      router.replace((returnTo || '/(tabs)') as any);
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
      <View style={[styles.content, { paddingTop: insets.top + 12 }]} testID="sign-in-screen">
        {/* Back button */}
        <Pressable style={styles.backBtn} onPress={() => router.replace('/(tabs)/' as any)}>
          <Lucide name="arrow-left" size={22} color={Colors.white} />
        </Pressable>

        {/* Top Branding */}
        <View style={styles.branding}>
          <Text style={styles.subtitle}>{s('brandSubtitle')}</Text>
          <Text style={styles.logo}>TT PORTAL</Text>
          <Text style={styles.tagline}>{s('splashSub')}</Text>
        </View>

        {/* Auth Form */}
        <View style={styles.form}>
          {/* Tabs */}
          <View style={styles.authTabs}>
            <Pressable
              style={[styles.authTab, activeTab === 'login' && styles.authTabActive]}
              onPress={() => handleTabSwitch('login')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'login' }}
              testID="tab-login"
            >
              <Text style={[styles.authTabText, activeTab === 'login' && styles.authTabTextActive]}>
                {s('authLogin')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.authTab, activeTab === 'signup' && styles.authTabActive]}
              onPress={() => handleTabSwitch('signup')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'signup' }}
              testID="tab-signup"
            >
              <Text style={[styles.authTabText, activeTab === 'signup' && styles.authTabTextActive]}>
                {s('authSignup')}
              </Text>
            </Pressable>
          </View>

          {/* Name Field (signup only) */}
          {activeTab === 'signup' && (
            <View style={styles.inputField}>
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

          {/* Email Field */}
          <View style={styles.inputField}>
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

          {/* Password Field */}
          <View style={styles.inputField}>
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

          {/* Forgot password link (login only) */}
          {activeTab === 'login' && (
            <Pressable
              onPress={() => router.push('/forgot-password')}
              testID="forgot-password-link"
            >
              <Text style={styles.forgotLink}>{s('authForgot')}</Text>
            </Pressable>
          )}

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

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={s('authSubmitSignup')}
            testID="submit-button"
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} testID="loading-spinner" />
            ) : (
              <>
                <Text style={styles.submitText}>
                  {activeTab === 'signup' ? s('authSubmitSignup') : s('authSubmitLogin')}
                </Text>
                <Lucide name="arrow-right" size={20} color={Colors.white} />
              </>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{s('authOrContinueWith')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Buttons */}
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

        {/* Bottom Section */}
        <View style={styles.bottom}>
          {activeTab === 'signup' && (
            <Text style={styles.terms} testID="terms-container">
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
          <View style={styles.langRow}>
            <Pressable style={lang === 'ro' ? styles.langActive : styles.langInactive} onPress={() => setLang('ro')}>
              <Text style={lang === 'ro' ? styles.langActiveText : styles.langInactiveText}>RO</Text>
            </Pressable>
            <Pressable style={lang === 'en' ? styles.langActive : styles.langInactive} onPress={() => setLang('en')}>
              <Text style={lang === 'en' ? styles.langActiveText : styles.langInactiveText}>EN</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.green,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 28,
  },
  branding: {
    alignItems: 'center',
    gap: 12,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.greenDim,
    opacity: 0.7,
  },
  logo: {
    fontFamily: Fonts.heading,
    fontSize: 42,
    fontWeight: '800',
    color: Colors.white,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.greenDim,
    textAlign: 'center',
    width: 260,
  },
  form: {
    gap: 14,
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: INPUT_BG,
    borderRadius: 12,
  },
  authTab: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  authTabActive: {
    backgroundColor: Colors.white,
  },
  authTabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.greenDim,
  },
  authTabTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  inputField: {
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
  forgotLink: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.greenDim,
    textAlign: 'right',
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
  socialBtnDisabled: {
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
  bottom: {
    alignItems: 'center',
    gap: 16,
  },
  terms: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
    textAlign: 'center',
    width: 280,
  },
  termsLink: {
    textDecorationLine: 'underline',
    color: Colors.white,
  },
  langRow: {
    flexDirection: 'row',
    gap: 4,
  },
  langActive: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langActiveText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.green,
  },
  langInactive: {
    borderRadius: 14,
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langInactiveText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkFaint,
  },
});
