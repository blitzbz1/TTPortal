import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

// --- Sign-in screen mocks ---

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSignInWithApple = jest.fn();
const mockSignOut = jest.fn();
const mockUseSession = jest.fn();

jest.mock('../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const ro: Record<string, string> = require('../locales/ro.json');
      return ro[key] || key;
    },
    lang: 'ro' as const,
    setLang: jest.fn(),
  }),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearchParams: Record<string, string> = {};
let mockPathname = '/(tabs)/';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
  }),
  useLocalSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

const mockExchangeCodeForSession = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...a: unknown[]) =>
        mockExchangeCodeForSession(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
    },
  },
}));

jest.mock('../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import SignInScreen from '../app/sign-in';
// eslint-disable-next-line import/first
import ResetPasswordScreen from '../app/reset-password';
// eslint-disable-next-line import/first
import { AuthGate } from '../components/AuthGate';

/** Default session mock for unauthenticated state. */
function mockAnonymousSession() {
  mockUseSession.mockReturnValue({
    session: null,
    user: null,
    isLoading: false,
    signUp: (...a: unknown[]) => mockSignUp(...a),
    signIn: (...a: unknown[]) => mockSignIn(...a),
    signInWithGoogle: (...a: unknown[]) => mockSignInWithGoogle(...a),
    signInWithApple: (...a: unknown[]) => mockSignInWithApple(...a),
    signOut: (...a: unknown[]) => mockSignOut(...a),
    resetPassword: jest.fn(),
  });
}

/** Default session mock for authenticated state. */
function mockAuthenticatedSession() {
  mockUseSession.mockReturnValue({
    session: {
      access_token: 'test-token',
      user: { id: 'user-1', email: 'user@example.com' },
    },
    user: {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { full_name: 'Ion Popescu' },
    },
    isLoading: false,
    signUp: (...a: unknown[]) => mockSignUp(...a),
    signIn: (...a: unknown[]) => mockSignIn(...a),
    signInWithGoogle: (...a: unknown[]) => mockSignInWithGoogle(...a),
    signInWithApple: (...a: unknown[]) => mockSignInWithApple(...a),
    signOut: (...a: unknown[]) => mockSignOut(...a),
    resetPassword: jest.fn(),
  });
}

describe('auth edge cases', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockPathname = '/(tabs)/';
    mockAnonymousSession();
  });

  describe('network drop during OAuth shows connection error and allows retry', () => {
    it('shows network error when Google sign-in throws', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error('Failed to fetch'));

      const { getByTestId, getByText } = render(<SignInScreen />);

      await user.press(getByTestId('google-button'));

      await waitFor(() => {
        expect(
          getByText('Eroare de conexiune. Încearcă din nou.'),
        ).toBeTruthy();
      });
    });

    it('re-enables Google button after network error so user can retry', async () => {
      mockSignInWithGoogle.mockRejectedValueOnce(new Error('Failed to fetch'));

      const { getByTestId, getByText } = render(<SignInScreen />);

      await user.press(getByTestId('google-button'));

      await waitFor(() => {
        expect(
          getByText('Eroare de conexiune. Încearcă din nou.'),
        ).toBeTruthy();
      });

      // Button should be re-enabled after error
      const googleBtn = getByTestId('google-button');
      expect(
        googleBtn.props.accessibilityState?.disabled ?? false,
      ).toBe(false);
    });

    it('allows successful retry after initial network failure', async () => {
      mockSignInWithGoogle
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce({ error: null });

      const { getByTestId, getByText } = render(<SignInScreen />);

      // First attempt — fails
      await user.press(getByTestId('google-button'));
      await waitFor(() => {
        expect(
          getByText('Eroare de conexiune. Încearcă din nou.'),
        ).toBeTruthy();
      });

      // Retry — succeeds
      await user.press(getByTestId('google-button'));
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
      });
    });
  });

  describe('session expiry during active use prompts re-auth without losing map context', () => {
    it('redirects to sign-in with returnTo when session expires', async () => {
      mockPathname = '/(tabs)/';

      // Start authenticated — children render
      mockAuthenticatedSession();

      const { rerender, getByText, queryByText } = render(
        <AuthGate>
          <Text>Map Content</Text>
        </AuthGate>,
      );

      expect(getByText('Map Content')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();

      // Session expires — session becomes null
      mockAnonymousSession();

      rerender(
        <AuthGate>
          <Text>Map Content</Text>
        </AuthGate>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/sign-in',
          params: { returnTo: '/(tabs)/' },
        });
      });

      // Children no longer render (guard is active)
      expect(queryByText('Map Content')).toBeNull();
    });

    it('preserves route context in returnTo param for protected routes', async () => {
      mockPathname = '/review/venue-123';

      mockAuthenticatedSession();

      const { rerender } = render(
        <AuthGate>
          <Text>Review Form</Text>
        </AuthGate>,
      );

      // Session expires
      mockAnonymousSession();

      rerender(
        <AuthGate>
          <Text>Review Form</Text>
        </AuthGate>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/sign-in',
          params: { returnTo: '/review/venue-123' },
        });
      });
    });
  });

  describe('registering with an OAuth-linked email shows account exists message suggesting OAuth provider', () => {
    it('shows account exists error with OAuth suggestion when email is already registered', async () => {
      mockSignUp.mockResolvedValue({
        error: {
          message: 'User already registered',
          code: 'user_already_exists',
          status: 422,
          name: 'AuthApiError',
        },
      });

      const { getByTestId, getByText } = render(<SignInScreen />);
      fireEvent.press(getByTestId('tab-signup'));

      // Fill signup form
      await user.type(getByTestId('input-name'), 'Test User');
      await user.type(getByTestId('input-email'), 'oauth@example.com');
      await user.type(getByTestId('input-password'), 'password123');
      await user.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(
          getByText(
            'Acest email este deja folosit. Încearcă conectarea cu Google sau Apple.',
          ),
        ).toBeTruthy();
      });
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does not navigate away when duplicate email error is shown', async () => {
      mockSignUp.mockResolvedValue({
        error: {
          message: 'User already registered',
          code: 'user_already_exists',
          status: 422,
          name: 'AuthApiError',
        },
      });

      const { getByTestId } = render(<SignInScreen />);
      fireEvent.press(getByTestId('tab-signup'));

      await user.type(getByTestId('input-name'), 'Test User');
      await user.type(getByTestId('input-email'), 'linked@example.com');
      await user.type(getByTestId('input-password'), 'password123');
      await user.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          'Test User',
          'linked@example.com',
          'password123',
        );
      });
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('password reset link used twice shows already-used message', () => {
    it('shows "already used" message when token has been consumed', async () => {
      mockSearchParams = { code: 'used-code-456' };
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Token has already been used' },
      });

      const { getByTestId, getByText } = render(<ResetPasswordScreen />);

      await waitFor(() => {
        expect(getByTestId('token-used')).toBeTruthy();
      });
      expect(
        getByText('Acest link a fost deja utilizat.'),
      ).toBeTruthy();
    });

    it('offers option to request a new link after used-token error', async () => {
      mockSearchParams = { code: 'used-code-456' };
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Token has already been used' },
      });

      const { getByTestId } = render(<ResetPasswordScreen />);

      await waitFor(() => {
        expect(getByTestId('token-used')).toBeTruthy();
      });

      // "Request new link" button should be present
      const requestNewLink = getByTestId('request-new-link');
      expect(requestNewLink).toBeTruthy();

      await user.press(requestNewLink);

      expect(mockReplace).toHaveBeenCalledWith('/forgot-password');
    });
  });
});
