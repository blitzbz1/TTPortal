import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;

let authCallback: AuthCallback | null = null;
const mockUnsubscribe = jest.fn();

const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
  error: null,
});

const mockSignUp = jest.fn().mockResolvedValue({
  data: { user: null, session: null },
  error: null,
});

const mockSignInWithPassword = jest.fn().mockResolvedValue({
  data: { user: null, session: null },
  error: null,
});

const mockSignInWithIdToken = jest.fn().mockResolvedValue({
  data: { user: null, session: null },
  error: null,
});

const mockSignOut = jest.fn().mockResolvedValue({ error: null });

const mockResetPasswordForEmail = jest.fn().mockResolvedValue({
  data: {},
  error: null,
});
const mockResend = jest.fn().mockResolvedValue({
  data: {},
  error: null,
});

const mockOnAuthStateChange = jest.fn(
  (...args: any[]) => {
    authCallback = args[0] as AuthCallback;
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
  },
);

const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });

const mockSignInWithOAuth = jest.fn().mockResolvedValue({
  data: { provider: 'apple', url: 'https://apple.auth' },
  error: null,
});

const mockUpdateUser = jest.fn().mockResolvedValue({
  data: { user: null },
  error: null,
});
const mockSetSession = jest.fn().mockResolvedValue({
  data: { session: null },
  error: null,
});

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: any[]) => mockGetSession(...a),
      signUp: (...a: any[]) => mockSignUp(...a),
      signInWithPassword: (...a: any[]) => mockSignInWithPassword(...a),
      signInWithIdToken: (...a: any[]) => mockSignInWithIdToken(...a),
      signInWithOAuth: (...a: any[]) => mockSignInWithOAuth(...a),
      updateUser: (...a: any[]) => mockUpdateUser(...a),
      setSession: (...a: any[]) => mockSetSession(...a),
      signOut: (...a: any[]) => mockSignOut(...a),
      resetPasswordForEmail: (...a: any[]) => mockResetPasswordForEmail(...a),
      resend: (...a: any[]) => mockResend(...a),
      onAuthStateChange: (...a: any[]) => mockOnAuthStateChange(...a),
    },
    from: () => ({ upsert: (...a: any[]) => mockUpsert(...a) }),
  },
}));

const mockGoogleSignIn = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: (...a: any[]) => mockGoogleSignIn(...a),
    hasPlayServices: jest.fn().mockResolvedValue(true),
  },
}));

const mockAppleSignIn = jest.fn();

jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...a: any[]) => mockAppleSignIn(...a),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

 
import React from 'react';
 
import { Text, Pressable } from 'react-native';
 
import { render, screen, act, waitFor, userEvent } from '@testing-library/react-native';
 
import { SessionProvider } from '../SessionProvider';
 
import { useSession } from '../../hooks/useSession';

const fakeUser: User = {
  id: 'user-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Test User' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const fakeSession: Session = {
  access_token: 'access-token-123',
  refresh_token: 'refresh-token-123',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: fakeUser,
};

function TestConsumer() {
  const ctx = useSession();
  return (
    <>
      <Text testID="isLoading">{String(ctx.isLoading)}</Text>
      <Text testID="session">{ctx.session ? 'has-session' : 'no-session'}</Text>
      <Text testID="user">{ctx.user?.email ?? 'no-user'}</Text>
      <Pressable
        testID="signUp"
        onPress={() => ctx.signUp('John Doe', 'john@example.com', 'password123')}
      >
        <Text>Sign Up</Text>
      </Pressable>
      <Pressable
        testID="signIn"
        onPress={() => ctx.signIn('john@example.com', 'password123')}
      >
        <Text>Sign In</Text>
      </Pressable>
      <Pressable testID="signOut" onPress={() => ctx.signOut()}>
        <Text>Sign Out</Text>
      </Pressable>
      <Pressable
        testID="resetPassword"
        onPress={() => ctx.resetPassword('john@example.com')}
      >
        <Text>Reset</Text>
      </Pressable>
      <Pressable
        testID="resendVerification"
        onPress={() => ctx.resendVerificationEmail('john@example.com')}
      >
        <Text>Resend Verification</Text>
      </Pressable>
      <Text testID="hasSignInWithGoogle">
        {typeof ctx.signInWithGoogle === 'function' ? 'yes' : 'no'}
      </Text>
      <Text testID="hasSignInWithApple">
        {typeof ctx.signInWithApple === 'function' ? 'yes' : 'no'}
      </Text>
    </>
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authCallback = null;
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('starts with isLoading=true', () => {
    // Prevent getSession from resolving during this test
    mockGetSession.mockReturnValue(new Promise(() => {}));

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    expect(screen.getByTestId('isLoading')).toHaveTextContent('true');
    expect(screen.getByTestId('session')).toHaveTextContent('no-session');
  });

  it('resolves to isLoading=false with session=null when no stored session', async () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('no-session');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('restores an existing session from storage on mount', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('has-session');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('subscribes to onAuthStateChange and unsubscribes on unmount', async () => {
    const { unmount } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    expect(typeof authCallback).toBe('function');

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('updates session when onAuthStateChange fires', async () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('no-session');

    await act(() => {
      authCallback!('SIGNED_IN', fakeSession);
    });

    expect(screen.getByTestId('session')).toHaveTextContent('has-session');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('signUp calls supabase.auth.signUp with correct params', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    await user.press(screen.getByTestId('signUp'));

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'john@example.com',
      password: 'password123',
      options: {
        data: { full_name: 'John Doe', auth_provider: 'email' },
        emailRedirectTo: 'ttportal://auth/callback?next=%2Fonboarding&flow=signup',
      },
    });
  });

  it('signIn calls supabase.auth.signInWithPassword with correct params', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    await user.press(screen.getByTestId('signIn'));

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'john@example.com',
      password: 'password123',
    });
  });

  it('signOut calls supabase.auth.signOut', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    await user.press(screen.getByTestId('signOut'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('resetPassword calls supabase.auth.resetPasswordForEmail with email', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    await user.press(screen.getByTestId('resetPassword'));

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('john@example.com', {
      redirectTo: 'ttportal://reset-password',
    });
  });

  it('resendVerificationEmail calls supabase.auth.resend with signup redirect', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    await user.press(screen.getByTestId('resendVerification'));

    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'john@example.com',
      options: {
        emailRedirectTo: 'ttportal://auth/callback?next=%2Fonboarding&flow=signup',
      },
    });
  });

  it('signInWithGoogle exists as a function on the context', async () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('hasSignInWithGoogle')).toHaveTextContent('yes');
  });

  it('signInWithApple exists as a function on the context', async () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('hasSignInWithApple')).toHaveTextContent('yes');
  });

  it('signInWithGoogle calls GoogleSignin.signIn and supabase.auth.signInWithIdToken', async () => {
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id-token-123',
        user: { id: 'g1', email: 'g@test.com', name: 'Google User', givenName: 'Google', familyName: 'User', photo: null },
        accessToken: 'access-token',
        serverAuthCode: null,
        scopes: ['email'],
      },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    let result: { error: unknown } | null = null;

    function GoogleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="google" onPress={async () => { result = await ctx.signInWithGoogle(); }}>
          <Text>Google</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><GoogleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    expect(mockGoogleSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-id-token-123' });
    expect(result).toEqual({ error: null });
  });

  it('signInWithGoogle upserts profile with auth_provider google on success', async () => {
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id-token-456',
        user: { id: 'g2', email: 'g2@test.com', name: 'Jane Doe', givenName: 'Jane', familyName: 'Doe', photo: null },
        accessToken: 'at',
        serverAuthCode: null,
        scopes: ['email'],
      },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    function GoogleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="google" onPress={() => ctx.signInWithGoogle()}>
          <Text>Google</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><GoogleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        { id: 'user-123', full_name: 'Jane Doe', email: 'test@example.com', auth_provider: 'google' },
        { onConflict: 'id' },
      );
    });
  });

  it('signInWithGoogle returns null error when user cancels', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'cancelled' });

    let result: { error: unknown } | null = null;

    function GoogleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="google" onPress={async () => { result = await ctx.signInWithGoogle(); }}>
          <Text>Google</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><GoogleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    expect(result).toEqual({ error: null });
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it('signInWithGoogle returns error when signInWithIdToken fails', async () => {
    const authError = { code: 'unexpected_failure', message: 'Server error', name: 'AuthApiError', status: 500 };
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id-token-789',
        user: { id: 'g3', email: 'g3@test.com', name: 'Fail User', givenName: 'Fail', familyName: 'User', photo: null },
        accessToken: 'at',
        serverAuthCode: null,
        scopes: ['email'],
      },
    });
    mockSignInWithIdToken.mockResolvedValue({ data: { user: null, session: null }, error: authError });

    let result: { error: unknown } | null = null;

    function GoogleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="google" onPress={async () => { result = await ctx.signInWithGoogle(); }}>
          <Text>Google</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><GoogleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    expect(result).toEqual({ error: authError });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('signInWithApple on iOS calls AppleAuthentication.signInAsync and supabase.auth.signInWithIdToken', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-id-token-123',
      fullName: { givenName: 'Jane', familyName: 'Doe' },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    let result: { error: unknown } | null = null;

    function AppleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="apple" onPress={async () => { result = await ctx.signInWithApple(); }}>
          <Text>Apple</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><AppleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('apple'));

    expect(mockAppleSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-id-token-123' });
    expect(result).toEqual({ error: null });
  });

  it('signInWithApple on iOS captures fullName and calls updateUser', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-id-token-name',
      fullName: { givenName: 'Maria', familyName: 'Popescu' },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    function AppleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="apple" onPress={() => ctx.signInWithApple()}>
          <Text>Apple</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><AppleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('apple'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'Maria Popescu' } });
    });
  });

  it('signInWithApple on iOS upserts profile with auth_provider apple', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-id-token-profile',
      fullName: { givenName: 'Ion', familyName: 'Ionescu' },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    function AppleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="apple" onPress={() => ctx.signInWithApple()}>
          <Text>Apple</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><AppleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('apple'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        { id: 'user-123', full_name: 'Ion Ionescu', email: 'test@example.com', auth_provider: 'apple' },
        { onConflict: 'id' },
      );
    });
  });

  it('signInWithApple on iOS returns error when signInWithIdToken fails', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
    const authError = { code: 'unexpected_failure', message: 'Server error', name: 'AuthApiError', status: 500 };
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-id-token-fail',
      fullName: null,
    });
    mockSignInWithIdToken.mockResolvedValue({ data: { user: null, session: null }, error: authError });

    let result: { error: unknown } | null = null;

    function AppleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="apple" onPress={async () => { result = await ctx.signInWithApple(); }}>
          <Text>Apple</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><AppleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('apple'));

    expect(result).toEqual({ error: authError });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('signInWithApple on Android falls back to signInWithOAuth', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'android');

    let result: { error: unknown } | null = null;

    function AppleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable testID="apple" onPress={async () => { result = await ctx.signInWithApple(); }}>
          <Text>Apple</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();
    render(<SessionProvider><AppleTestConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('apple'));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: 'ttportal://auth/callback?next=%2F%28tabs%29&flow=oauth' },
    });
    expect(mockAppleSignIn).not.toHaveBeenCalled();
    expect(result).toEqual({ error: null, isRedirecting: true });
  });

  it('signUp returns error when supabase returns an error', async () => {
    const authError = { code: 'user_already_exists', message: 'User already registered', name: 'AuthApiError', status: 422 };
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError,
    });

    let result: { error: unknown } | null = null;

    function ErrorTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable
          testID="signUpError"
          onPress={async () => {
            result = await ctx.signUp('John', 'john@example.com', 'pass1234');
          }}
        >
          <Text>Sign Up</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();

    render(
      <SessionProvider>
        <ErrorTestConsumer />
      </SessionProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await user.press(screen.getByTestId('signUpError'));

    expect(result).not.toBeNull();
    expect(result!.error).toBe(authError);
  });
});

describe('useSession', () => {
  it('throws when used outside SessionProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useSession must be used within a SessionProvider',
    );

    spy.mockRestore();
  });
});
