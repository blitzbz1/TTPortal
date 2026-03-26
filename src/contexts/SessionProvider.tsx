import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

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
  /** Google OAuth flow (stub — not yet implemented until US3). */
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
    throw new Error('signInWithGoogle not yet implemented');
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
