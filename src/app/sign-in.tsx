import React, { useState, useCallback, useMemo } from 'react';
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
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius } from '../theme';
import { Lucide } from '../components/Icon';
import { logger } from '../lib/logger';
import { isValidEmail, isStrongPassword, mapAuthErrorToKey, sanitizeRoute } from '../lib/auth-utils';

const TERMS_URL = 'https://ttportal.ro/terms';
const PRIVACY_URL = 'https://ttportal.ro/privacy';

export default function SignInScreen() {
  const { returnTo, initialTab } = useLocalSearchParams<{
    returnTo?: string;
    initialTab?: 'signup' | 'login';
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, signIn, signInWithGoogle, signInWithApple } = useSession();
  const { s, lang, setLang } = useI18n();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState<'signup' | 'login'>(
    (initialTab as 'signup' | 'login') || 'login',
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleTabSwitch = useCallback(
    (tab: 'signup' | 'login') => {
      setActiveTab(tab);
      setError(null);
      setSuccessMessage(null);
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
    if (!isStrongPassword(password)) {
      setError(s('validationPasswordStrength'));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const isLogin = activeTab === 'login';
      logger.track(isLogin ? 'login_submit' : 'signup_submit', { email });
      const authResult = isLogin
        ? await signIn(email, password)
        : await signUp(fullName, email, password);
      const { error: authError } = authResult;
      if (authError) {
        logger.warn(isLogin ? 'login failed' : 'signup failed', {
          code: authError.code,
        });
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      logger.info(isLogin ? 'login success' : 'signup success');
      if (!isLogin) {
        if (authResult.requiresEmailVerification) {
          setSuccessMessage(s('authVerifyEmailNotice'));
          setPassword('');
          setActiveTab('login');
          return;
        }
        router.replace('/onboarding' as any);
      } else {
        router.replace(sanitizeRoute(returnTo) as any);
      }
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
    setSuccessMessage(null);
    try {
      logger.track('google_signin_submit');
      const { error: authError, isRedirecting } = await signInWithGoogle(sanitizeRoute(returnTo));
      if (authError) {
        logger.warn('Google sign-in failed', { code: authError.code });
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      logger.info('Google sign-in success');
      if (!isRedirecting) {
        router.replace(sanitizeRoute(returnTo) as any);
      }
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
    setSuccessMessage(null);
    try {
      logger.track('apple_signin_submit');
      const { error: authError, isRedirecting } = await signInWithApple(sanitizeRoute(returnTo));
      if (authError) {
        logger.warn('Apple sign-in failed', { code: authError.code });
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      logger.info('Apple sign-in success');
      if (!isRedirecting) {
        router.replace(sanitizeRoute(returnTo) as any);
      }
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
          <Lucide name="arrow-left" size={22} color={isDark ? colors.text : colors.textOnPrimary} />
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
              <Lucide name="user" size={18} color={colors.textFaint} />
              <TextInput
                placeholder={s('authFullName')}
                placeholderTextColor={colors.textFaint}
                value={fullName}
                onChangeText={setFullName}
                accessibilityLabel={s('authFullName')}
                style={styles.textInput}
                testID="input-name"
                maxLength={100}
              />
            </View>
          )}

          {/* Email Field */}
          <View style={styles.inputField}>
            <Lucide name="mail" size={18} color={colors.textFaint} />
            <TextInput
              placeholder={s('authEmail')}
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={setEmail}
              accessibilityLabel={s('authEmail')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.textInput}
              testID="input-email"
              maxLength={254}
            />
          </View>

          {/* Password Field */}
          <View style={styles.inputField}>
            <Lucide name="lock" size={18} color={colors.textFaint} />
            <TextInput
              placeholder={s('authPassword')}
              placeholderTextColor={colors.textFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              accessibilityLabel={s('authPassword')}
              autoCapitalize="none"
              style={[styles.textInput, { flex: 1 }]}
              testID="input-password"
              maxLength={128}
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
                color={colors.textFaint}
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

          {successMessage && (
            <Text testID="success-message" style={styles.successText}>
              {successMessage}
            </Text>
          )}

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={activeTab === 'signup' ? s('authSubmitSignup') : s('authSubmitLogin')}
            testID="submit-button"
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={isDark ? colors.black : colors.textOnPrimary} testID="loading-spinner" />
            ) : (
              <>
                <Text style={styles.submitText}>
                  {activeTab === 'signup' ? s('authSubmitSignup') : s('authSubmitLogin')}
                </Text>
                <Lucide name="arrow-right" size={20} color={isDark ? colors.black : colors.textOnPrimary} />
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
              <Lucide name="apple" size={20} color={isDark ? colors.text : colors.textOnPrimary} />
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

function createStyles(colors: ThemeColors, isDark: boolean) {
  // In light mode the screen uses dark-green (primary) as bg with white text.
  // In dark mode we flip: dark bg with green accents.
  const pageBg = isDark ? colors.bg : colors.primary;
  const headingColor = isDark ? colors.text : colors.textOnPrimary;
  const subtitleColor = isDark ? colors.textMuted : colors.primaryDim;
  const inputBg = isDark ? colors.bgMuted : colors.authInputBg;
  const inputText = isDark ? colors.text : colors.textOnPrimary;
  const tabInactiveText = isDark ? colors.textFaint : colors.primaryDim;
  const tabActiveText = isDark ? colors.primary : colors.primary;
  const tabActiveBg = isDark ? colors.bgAlt : colors.bgAlt;
  const forgotColor = isDark ? colors.textMuted : colors.primaryDim;
  const submitBg = isDark ? colors.primary : colors.primaryLight;
  const submitText = isDark ? colors.black : colors.textOnPrimary;
  const dividerColor = isDark ? colors.border : colors.authInputBg;
  const googleBtnBg = isDark ? colors.bgAlt : colors.bgAlt;
  const googleBtnText = isDark ? colors.text : colors.primary;
  const appleBorder = isDark ? colors.border : colors.primaryDim;
  const appleTextColor = isDark ? colors.text : colors.textOnPrimary;
  const linkColor = isDark ? colors.primary : colors.textOnPrimary;
  const langActiveText = isDark ? colors.primary : colors.primary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: pageBg,
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
      color: subtitleColor,
      opacity: 0.7,
    },
    logo: {
      fontFamily: Fonts.heading,
      fontSize: 42,
      fontWeight: '800',
      color: headingColor,
    },
    tagline: {
      fontFamily: Fonts.body,
      fontSize: 16,
      color: subtitleColor,
      textAlign: 'center',
      width: 260,
    },
    form: {
      gap: 14,
    },
    authTabs: {
      flexDirection: 'row',
      backgroundColor: inputBg,
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
      backgroundColor: tabActiveBg,
    },
    authTabText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '500',
      color: tabInactiveText,
    },
    authTabTextActive: {
      color: tabActiveText,
      fontWeight: '600',
    },
    inputField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: inputBg,
      borderRadius: Radius.md,
      height: 48,
      paddingHorizontal: 14,
      gap: 10,
    },
    textInput: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: 14,
      color: inputText,
      height: 48,
      paddingVertical: 0,
    },
    forgotLink: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: forgotColor,
      textAlign: 'right',
    },
    errorText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.red,
      textAlign: 'center',
    },
    successText: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: isDark ? colors.primary : colors.primaryLight,
      textAlign: 'center',
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: submitBg,
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
      color: submitText,
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
      backgroundColor: dividerColor,
    },
    dividerText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? colors.textFaint : colors.textFaint,
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
      backgroundColor: googleBtnBg,
      borderRadius: Radius.md,
      height: 46,
      gap: 8,
    },
    googleIcon: {
      fontFamily: Fonts.heading,
      fontSize: 18,
      fontWeight: '800',
      color: googleBtnText,
    },
    googleText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: googleBtnText,
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
      borderColor: appleBorder,
    },
    appleText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: appleTextColor,
    },
    bottom: {
      alignItems: 'center',
      gap: 16,
    },
    terms: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
      textAlign: 'center',
      width: 280,
    },
    termsLink: {
      textDecorationLine: 'underline',
      color: linkColor,
    },
    langRow: {
      flexDirection: 'row',
      gap: 4,
    },
    langActive: {
      backgroundColor: colors.bgAlt,
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
      color: langActiveText,
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
      color: colors.textFaint,
    },
  });
}
