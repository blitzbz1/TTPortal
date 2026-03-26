import React, { useContext } from 'react';
import { render, userEvent, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

// --- Sign-in screen mocks ---

const mockSignIn = jest.fn();
const mockUseSession = jest.fn();

jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const ro: Record<string, string> = require('../../locales/ro.json');
      return ro[key] || key;
    },
    lang: 'ro' as const,
    setLang: jest.fn(),
  }),
}));

const mockReplace = jest.fn();
const mockSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a) }),
  useLocalSearchParams: () => mockSearchParams(),
}));

// --- SessionProvider mocks (for session persistence test) ---

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;
let authCallback: AuthCallback | null = null;

const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
  error: null,
});

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
      onAuthStateChange: (...args: unknown[]) => {
        authCallback = args[0] as AuthCallback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
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

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    hasPlayServices: jest.fn(),
  },
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// eslint-disable-next-line import/first
import SignInScreen from '../sign-in';
// eslint-disable-next-line import/first
import { SessionProvider, SessionContext } from '../../contexts/SessionProvider';

const fakeUser: User = {
  id: 'user-456',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'returning@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-03-26T10:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Returning User' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-26T10:00:00Z',
};

const fakeSession: Session = {
  access_token: 'access-token-login',
  refresh_token: 'refresh-token-login',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: fakeUser,
};

/** Fills the login form with valid data and presses submit. */
async function fillAndSubmitLogin(
  getByTestId: ReturnType<typeof render>['getByTestId'],
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(getByTestId('input-email'), 'john@example.com');
  await user.type(getByTestId('input-password'), 'password123');
  await user.press(getByTestId('submit-button'));
}

describe('SignInScreen — login flow (T017)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    authCallback = null;
    mockSignIn.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signIn: (...a: unknown[]) => mockSignIn(...a),
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams.mockReturnValue({ initialTab: 'login' });
    mockReplace.mockReset();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('successful signIn navigates to /(tabs)/', async () => {
    const { getByTestId } = render(<SignInScreen />);

    await fillAndSubmitLogin(getByTestId, user);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('incorrect credentials show "Email sau parola incorectă"', async () => {
    mockSignIn.mockResolvedValue({
      error: {
        message: 'Invalid login credentials',
        code: 'invalid_credentials',
        status: 400,
        name: 'AuthApiError',
      },
    });

    const { getByTestId, getByText } = render(<SignInScreen />);

    await fillAndSubmitLogin(getByTestId, user);

    await waitFor(() => {
      expect(getByText('Email sau parola incorectă')).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('session persists — onAuthStateChange emitting a session updates useSession', async () => {
    /** Test consumer that reads session state directly from SessionContext. */
    function SessionTestConsumer() {
      const ctx = useContext(SessionContext)!;
      return (
        <>
          <Text testID="session-status">
            {ctx.session ? 'has-session' : 'no-session'}
          </Text>
          <Text testID="session-email">
            {ctx.user?.email ?? 'no-user'}
          </Text>
        </>
      );
    }

    const { getByTestId } = render(
      <SessionProvider>
        <SessionTestConsumer />
      </SessionProvider>,
    );

    // Wait for initial session restore (null)
    await waitFor(() => {
      expect(getByTestId('session-status').props.children).toBe('no-session');
    });

    // Simulate onAuthStateChange emitting a session (e.g. after login)
    await act(() => {
      authCallback!('SIGNED_IN', fakeSession);
    });

    // Verify useSession now returns the session
    expect(getByTestId('session-status').props.children).toBe('has-session');
    expect(getByTestId('session-email').props.children).toBe(
      'returning@example.com',
    );
  });

  it('returnTo param is honored after successful login', async () => {
    mockSearchParams.mockReturnValue({
      initialTab: 'login',
      returnTo: '/add-venue',
    });

    const { getByTestId } = render(<SignInScreen />);

    await fillAndSubmitLogin(getByTestId, user);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/add-venue');
    });
  });
});
