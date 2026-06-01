import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  getEmailConfirmationRedirectUrl,
  getOAuthRedirectUrl,
  getPasswordResetRedirectUrl,
} from '../lib/auth-redirects';

// Lazy-load GoogleSignin to avoid crashing in Expo Go where native module is unavailable
let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin | null = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (googleWebClientId && !googleWebClientId.startsWith('YOUR_')) {
    GoogleSignin!.configure({ webClientId: googleWebClientId });
  } else {
    logger.warn('Google Sign-In not configured: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing or placeholder');
  }
} catch {
  logger.warn('Google Sign-In native module not available (Expo Go). Google sign-in will be disabled.');
}

/** Result type for auth operations that may fail. */
interface AuthResult {
  error: AuthError | null;
  isRedirecting?: boolean;
  requiresEmailVerification?: boolean;
}

/** Context value exposed by SessionProvider per Auth Context Contract. */
export interface SessionContextValue {
  /** Current auth session (null if anonymous). */
  session: Session | null;
  /** Current user from the session (null if anonymous). */
  user: User | null;
  /** True while initial session is being restored from storage. */
  isLoading: boolean;
  /** Email registration. */
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  /** Email login. */
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Google OAuth flow via native Google Sign-In + Supabase signInWithIdToken. */
  signInWithGoogle: (returnTo?: string) => Promise<AuthResult>;
  /** Apple auth flow — native on iOS, OAuth web fallback on Android. */
  signInWithApple: (returnTo?: string) => Promise<AuthResult>;
  /** End current session. */
  signOut: () => Promise<AuthResult>;
  /** Send password reset email. */
  resetPassword: (email: string) => Promise<AuthResult>;
  /** Resend signup verification email. */
  resendVerificationEmail: (email: string) => Promise<AuthResult>;
}

/** @internal Exported for useSession hook consumption. */
export const SessionContext = createContext<SessionContextValue | null>(null);

/** Props for SessionProvider. */
interface SessionProviderProps {
  children: React.ReactNode;
}

/**
 * Auth state provider that wraps Supabase `onAuthStateChange` listener.
 * On mount, restores session from storage and sets `isLoading=false` once resolved.
 * Exposes auth methods per the Auth Context Contract.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      setSession(restored);
      setIsLoading(false);
      logger.info('Session restored', {
        hasSession: restored !== null,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        logger.debug('Auth state changed', { event: _event });
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            auth_provider: 'email',
          },
          emailRedirectTo: getEmailConfirmationRedirectUrl(),
        },
      });
      if (error) {
        logger.warn('Sign up failed', { code: error.code });
      } else {
        logger.info('User signed up', {
          requiresEmailVerification: data.session == null,
        });
      }
      return {
        error,
        requiresEmailVerification: !error && data.session == null,
      };
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        logger.warn('Sign in failed', { code: error.code });
      } else {
        logger.info('User signed in');
      }
      return { error };
    },
    [],
  );

  const signInWithGoogle = useCallback(async (returnTo?: string): Promise<AuthResult> => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(returnTo),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) {
        logger.warn('Google web sign-in failed', { code: error.code });
        return { error };
      }
      logger.info('Google web sign-in initiated');
      return { error: null, isRedirecting: true };
    }

    if (!GoogleSignin) {
      logger.warn('Google Sign-In unavailable (native module not loaded)');
      return { error: { message: 'Google Sign-In is not available in Expo Go. Use a development build.', name: 'AuthApiError', status: 0 } as unknown as AuthError };
    }
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices();
    }
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') {
      return { error: null };
    }
    const idToken = result.data.idToken;
    if (!idToken) {
      logger.warn('Google sign-in: no idToken received');
      return { error: { message: 'No ID token from Google', name: 'AuthApiError', status: 0 } as unknown as AuthError };
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) {
      logger.warn('Google sign-in failed', { code: error.code });
      return { error };
    }
    if (data.user) {
      const fullName = result.data.user.name || data.user.user_metadata?.full_name || '';
      const { error: profileError } = await supabase.from('profiles').upsert(
        { id: data.user.id, full_name: fullName, email: data.user.email || '', auth_provider: 'google' },
        { onConflict: 'id' },
      );
      if (profileError) {
        logger.warn('Profile upsert failed after Google sign-in', { error: profileError.message });
      }
      const providers = data.user.app_metadata?.providers as string[] | undefined;
      if (providers && providers.includes('email') && providers.includes('google')) {
        logger.info('Google account linked to existing email account', {
          userId: data.user.id,
          providers,
        });
      }
    }
    logger.info('Google sign-in success', { userId: data.user?.id });
    return { error: null };
  }, []);

  const signInWithApple = useCallback(async (returnTo?: string): Promise<AuthResult> => {
    if (Platform.OS !== 'ios') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: getOAuthRedirectUrl(returnTo),
        },
      });
      if (error) {
        logger.warn('Apple sign-in OAuth failed', { code: error.code });
      } else {
        logger.info('Apple sign-in OAuth initiated (Android)');
      }
      return { error: error ?? null, isRedirecting: error == null };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      logger.warn('Apple sign-in: no identityToken received');
      return { error: { message: 'No identity token from Apple', name: 'AuthApiError', status: 0 } as unknown as AuthError };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) {
      logger.warn('Apple sign-in failed', { code: error.code });
      return { error };
    }

    const givenName = credential.fullName?.givenName || '';
    const familyName = credential.fullName?.familyName || '';
    const appleName = [givenName, familyName].filter(Boolean).join(' ');
    if (appleName) {
      await supabase.auth.updateUser({ data: { full_name: appleName } });
    }

    if (data.user) {
      const profileData: { id: string; email: string; auth_provider: string; full_name?: string } = {
        id: data.user.id,
        email: data.user.email || '',
        auth_provider: 'apple',
      };
      if (appleName) {
        profileData.full_name = appleName;
      }
      const { error: profileError } = await supabase.from('profiles').upsert(
        profileData,
        { onConflict: 'id' },
      );
      if (profileError) {
        logger.warn('Profile upsert failed after Apple sign-in', { error: profileError.message });
      }
    }
    logger.info('Apple sign-in success', { userId: data.user?.id });
    return { error: null };
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.warn('Sign out failed', { code: error.code });
    } else {
      logger.info('User signed out');
    }
    return { error };
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      if (error) {
        logger.warn('Reset password failed', { code: error.code });
      } else {
        logger.info('Password reset email sent');
      }
      return { error };
    },
    [],
  );

  const resendVerificationEmail = useCallback(
    async (email: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getEmailConfirmationRedirectUrl(),
        },
      });
      if (error) {
        logger.warn('Resend verification email failed', { code: error.code });
      } else {
        logger.info('Verification email resent');
      }
      return { error };
    },
    [],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user,
      isLoading,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      resetPassword,
      resendVerificationEmail,
    }),
    [
      session,
      user,
      isLoading,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      resetPassword,
      resendVerificationEmail,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
