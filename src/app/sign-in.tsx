import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
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
 * Auth screen with signup/login tabs.
 * Scaffold — T014/T015 will add full styling and design system integration.
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
      const { error: authError } = await signUp(fullName, email, password);
      if (authError) {
        setError(s(mapAuthErrorToKey(authError)));
        return;
      }
      router.replace(returnTo || '/(tabs)/');
    } catch {
      setError(s('errorNetwork'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, fullName, email, password, signUp, s, router, returnTo]);

  return (
    <View testID="sign-in-screen">
      <Pressable
        onPress={() => setActiveTab('signup')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'signup' }}
        testID="tab-signup"
      >
        <Text>{s('authSignup')}</Text>
      </Pressable>
      <Pressable
        onPress={() => setActiveTab('login')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'login' }}
        testID="tab-login"
      >
        <Text>{s('authLogin')}</Text>
      </Pressable>

      {activeTab === 'signup' && (
        <TextInput
          placeholder={s('authFullName')}
          value={fullName}
          onChangeText={setFullName}
          accessibilityLabel={s('authFullName')}
          testID="input-name"
        />
      )}

      <TextInput
        placeholder={s('authEmail')}
        value={email}
        onChangeText={setEmail}
        accessibilityLabel={s('authEmail')}
        keyboardType="email-address"
        autoCapitalize="none"
        testID="input-email"
      />

      <TextInput
        placeholder={s('authPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!passwordVisible}
        accessibilityLabel={s('authPassword')}
        testID="input-password"
      />

      <Pressable
        onPress={() => setPasswordVisible((v) => !v)}
        accessibilityLabel="toggle-password-visibility"
        testID="toggle-password"
      >
        <Text>{passwordVisible ? 'Hide' : 'Show'}</Text>
      </Pressable>

      {error && (
        <Text accessibilityRole="alert" testID="error-message">
          {error}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={s('authSubmitSignup')}
        testID="submit-button"
      >
        <Text>{s('authSubmitSignup')}</Text>
      </Pressable>
    </View>
  );
}
