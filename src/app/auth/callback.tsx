import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../theme';
import { Fonts } from '../../theme';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { sanitizeAppRoute } from '../../lib/auth-redirects';

type CallbackState = 'processing' | 'error' | 'expired';
type EmailOtpType =
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'invite'
  | 'email_change'
  | 'email';

const EMAIL_OTP_TYPES: ReadonlySet<EmailOtpType> = new Set([
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
  'email',
]);

function getDefaultRoute(flow?: string) {
  return flow === 'signup' ? '/onboarding' : '/(tabs)';
}

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getEmailOtpType(rawType?: string, flow?: string): EmailOtpType | null {
  if (!rawType) {
    return flow === 'signup' ? 'signup' : null;
  }

  const normalized = rawType.toLowerCase() as EmailOtpType;
  return EMAIL_OTP_TYPES.has(normalized) ? normalized : null;
}

interface CallbackParams {
  accessToken?: string;
  code?: string;
  errorCode?: string;
  errorDescription?: string;
  flow?: string;
  next?: string;
  refreshToken?: string;
  tokenHash?: string;
  type?: string;
}

function readCallbackParams(
  rawParams: Record<string, string | string[] | undefined>,
): CallbackParams {
  return {
    code: getParamValue(rawParams.code),
    tokenHash: getParamValue(rawParams.token_hash),
    type: getParamValue(rawParams.type),
    next: getParamValue(rawParams.next),
    flow: getParamValue(rawParams.flow),
    errorDescription: getParamValue(rawParams.error_description),
    errorCode: getParamValue(rawParams.error_code),
    accessToken: getParamValue(rawParams.access_token),
    refreshToken: getParamValue(rawParams.refresh_token),
  };
}

function readCallbackParamsFromUrl(url: string): CallbackParams {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const fragment = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;
  const stateQuery = fragment?.get('sb')?.startsWith('?')
    ? new URLSearchParams(fragment.get('sb')!.slice(1))
    : null;

  const readString = (
    key: string,
    fallback?: URLSearchParams | null,
  ) => {
    const queryValue = query[key];
    if (typeof queryValue === 'string') {
      return queryValue;
    }

    const fragmentValue = fragment?.get(key);
    if (fragmentValue) {
      return fragmentValue;
    }

    return fallback?.get(key) ?? undefined;
  };

  return {
    code: readString('code', stateQuery),
    tokenHash: readString('token_hash', stateQuery),
    type: readString('type', stateQuery),
    next: readString('next', stateQuery),
    flow: readString('flow', stateQuery),
    errorDescription: readString('error_description'),
    errorCode: readString('error_code'),
    accessToken: readString('access_token'),
    refreshToken: readString('refresh_token'),
  };
}

function isExpiredCallback(errorCode?: string, errorDescription?: string) {
  if (errorCode?.toLowerCase() === 'otp_expired') {
    return true;
  }

  const normalized = errorDescription?.toLowerCase() ?? '';
  return normalized.includes('expired') || normalized.includes('invalid');
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
    flow?: string;
    error_description?: string;
  }>();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<CallbackState>('processing');

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const directParams = readCallbackParams(params);
      const initialUrl = await Linking.getInitialURL();
      const urlParams = initialUrl ? readCallbackParamsFromUrl(initialUrl) : {};
      const callback = {
        ...urlParams,
        ...Object.fromEntries(
          Object.entries(directParams).filter(([, value]) => value !== undefined),
        ),
      };
      const flow = callback.flow;
      const next = sanitizeAppRoute(callback.next ?? getDefaultRoute(flow));
      const code = callback.code;
      const tokenHash = callback.tokenHash;
      const accessToken = callback.accessToken;
      const refreshToken = callback.refreshToken;
      const otpType = getEmailOtpType(callback.type, flow);
      let callbackResult:
        | {
            session?: unknown;
            user?: unknown;
          }
        | undefined;

      if (callback.errorDescription) {
        logger.warn('Auth callback returned error', {
          error: callback.errorDescription,
          code: callback.errorCode,
        });
        if (!cancelled) {
          setState(isExpiredCallback(callback.errorCode, callback.errorDescription) ? 'expired' : 'error');
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          logger.warn('Auth callback token session restore failed', { error: error.message });
          if (!cancelled) setState('error');
          return;
        }
        callbackResult = data;
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          logger.warn('Auth callback code exchange failed', { error: error.message });
          if (!cancelled) setState('error');
          return;
        }
        callbackResult = data;
      } else if (tokenHash && otpType) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (error) {
          logger.warn('Auth callback token verification failed', {
            error: error.message,
            type: otpType,
          });
          if (!cancelled) setState('error');
          return;
        }
        callbackResult = data;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session && flow === 'signup' && callbackResult?.user) {
        logger.info('Auth callback verified signup without session; routing to sign-in');
        if (!cancelled) {
          router.replace({ pathname: '/sign-in', params: { initialTab: 'login' } });
        }
        return;
      }

      if (!session) {
        logger.warn('Auth callback finished without a session');
        if (!cancelled) setState('error');
        return;
      }

      logger.info('Auth callback completed', { next });
      if (!cancelled) {
        router.replace(next as any);
      }
    }

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  if (state === 'processing') {
    return (
      <View style={styles.container} testID="auth-callback-loading">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{s('authCallbackProcessing')}</Text>
      </View>
    );
  }

  if (state === 'expired') {
    return (
      <View style={styles.container} testID="auth-callback-expired">
        <Text style={styles.message}>{s('authCallbackExpired')}</Text>
        <Pressable
          onPress={() => router.replace({ pathname: '/sign-in', params: { initialTab: 'login' } })}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{s('authCallbackBackToLogin')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="auth-callback-error">
      <Text style={styles.message}>{s('authCallbackError')}</Text>
      <Pressable
        onPress={() => router.replace({ pathname: '/sign-in', params: { initialTab: 'login' } })}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{s('authCallbackBackToLogin')}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingHorizontal: 28,
      backgroundColor: colors.bg,
    },
    message: {
      fontFamily: Fonts.body,
      fontSize: 15,
      textAlign: 'center',
      color: colors.text,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    buttonText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  });
}
