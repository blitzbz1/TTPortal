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

const mockSignOut = jest.fn().mockResolvedValue({ error: null });

const mockResetPasswordForEmail = jest.fn().mockResolvedValue({
  data: {},
  error: null,
});

const mockOnAuthStateChange = jest.fn(
  (...args: any[]) => {
    authCallback = args[0] as AuthCallback;
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
  },
);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: any[]) => mockGetSession(...a),
      signUp: (...a: any[]) => mockSignUp(...a),
      signInWithPassword: (...a: any[]) => mockSignInWithPassword(...a),
      signOut: (...a: any[]) => mockSignOut(...a),
      resetPasswordForEmail: (...a: any[]) => mockResetPasswordForEmail(...a),
      onAuthStateChange: (...a: any[]) => mockOnAuthStateChange(...a),
    },
  },
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

// eslint-disable-next-line import/first
import React from 'react';
// eslint-disable-next-line import/first
import { Text, Pressable } from 'react-native';
// eslint-disable-next-line import/first
import { render, screen, act, waitFor, userEvent } from '@testing-library/react-native';
// eslint-disable-next-line import/first
import { SessionProvider } from '../SessionProvider';
// eslint-disable-next-line import/first
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
      options: { data: { full_name: 'John Doe' } },
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

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('john@example.com');
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

  it('signInWithGoogle throws "not yet implemented"', async () => {
    let caughtError: Error | null = null;

    function GoogleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable
          testID="google"
          onPress={async () => {
            try {
              await ctx.signInWithGoogle();
            } catch (err) {
              caughtError = err as Error;
            }
          }}
        >
          <Text>Google</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();

    render(
      <SessionProvider>
        <GoogleTestConsumer />
      </SessionProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await user.press(screen.getByTestId('google'));

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError!.message).toBe('signInWithGoogle not yet implemented');
  });

  it('signInWithApple throws "not yet implemented"', async () => {
    let caughtError: Error | null = null;

    function AppleTestConsumer() {
      const ctx = useSession();
      return (
        <Pressable
          testID="apple"
          onPress={async () => {
            try {
              await ctx.signInWithApple();
            } catch (err) {
              caughtError = err as Error;
            }
          }}
        >
          <Text>Apple</Text>
        </Pressable>
      );
    }

    const user = userEvent.setup();

    render(
      <SessionProvider>
        <AppleTestConsumer />
      </SessionProvider>,
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await user.press(screen.getByTestId('apple'));

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError!.message).toBe('signInWithApple not yet implemented');
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
