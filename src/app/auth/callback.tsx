import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../theme';
import { Fonts } from '../../theme';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { sanitizeAppRoute } from '../../lib/auth-redirects';

type CallbackState = 'processing' | 'error';

function getDefaultRoute(flow?: string) {
  return flow === 'signup' ? '/onboarding' : '/(tabs)';
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
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
      const next = sanitizeAppRoute(params.next ?? getDefaultRoute(params.flow));

      if (params.error_description) {
        logger.warn('Auth callback returned error', {
          error: params.error_description,
        });
        if (!cancelled) setState('error');
        return;
      }

      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) {
          logger.warn('Auth callback code exchange failed', { error: error.message });
          if (!cancelled) setState('error');
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
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
