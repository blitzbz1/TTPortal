import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

/** Result type for auth operations that may fail. */
interface AuthResult {
  error: AuthError | null;
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
  signInWithGoogle: () => Promise<AuthResult>;
  /** Apple auth flow (stub — not yet implemented until US4). */
  signInWithApple: () => Promise<AuthResult>;
  /** End current session. */
  signOut: () => Promise<AuthResult>;
  /** Send password reset email. */
  resetPassword: (email: string) => Promise<AuthResult>;
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        logger.warn('Sign up failed', { email, code: error.code });
      } else {
        logger.info('User signed up', { email });
      }
      return { error };
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
        logger.warn('Sign in failed', { email, code: error.code });
      } else {
        logger.info('User signed in', { email });
      }
      return { error };
    },
    [],
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
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

  const signInWithApple = useCallback(async (): Promise<AuthResult> => {
    throw new Error('signInWithApple not yet implemented');
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
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        logger.warn('Reset password failed', { email, code: error.code });
      } else {
        logger.info('Password reset email sent', { email });
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
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
