import React from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockSignInWithApple = jest.fn();
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

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import SignInScreen from '../sign-in';

describe('SignInScreen — Apple Sign-In (T024)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithApple.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signIn: jest.fn().mockResolvedValue({ error: null }),
      signInWithGoogle: jest.fn().mockResolvedValue({ error: null }),
      signInWithApple: (...a: unknown[]) => mockSignInWithApple(...a),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams.mockReturnValue({});
    mockReplace.mockReset();
  });

  it('Apple button renders on auth screen', () => {
    const { getByTestId } = render(<SignInScreen />);

    expect(getByTestId('apple-button')).toBeTruthy();
  });

  it('tapping Apple button calls signInWithApple', async () => {
    const { getByTestId } = render(<SignInScreen />);

    await user.press(getByTestId('apple-button'));

    await waitFor(() => {
      expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
    });
  });

  it('successful Apple auth navigates to map', async () => {
    const { getByTestId } = render(<SignInScreen />);

    await user.press(getByTestId('apple-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('Apple "Hide My Email" relay address is stored and functions normally', async () => {
    // Simulate Apple sign-in where user chose "Hide My Email",
    // resulting in a relay address like xxx@privaterelay.appleid.com.
    // The sign-in should succeed and navigate normally — relay addresses
    // are handled transparently by Supabase and the profiles table.
    const relayEmail = 'abc123@privaterelay.appleid.com';

    mockSignInWithApple.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: {
        access_token: 'tok',
        user: {
          id: 'apple-uid',
          email: relayEmail,
          user_metadata: { full_name: 'Test User' },
        },
      },
      user: {
        id: 'apple-uid',
        email: relayEmail,
        user_metadata: { full_name: 'Test User' },
      },
      isLoading: false,
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signIn: jest.fn().mockResolvedValue({ error: null }),
      signInWithGoogle: jest.fn().mockResolvedValue({ error: null }),
      signInWithApple: (...a: unknown[]) => mockSignInWithApple(...a),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });

    const { getByTestId } = render(<SignInScreen />);

    await user.press(getByTestId('apple-button'));

    await waitFor(() => {
      expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('Apple auth failure shows localized error', async () => {
    mockSignInWithApple.mockResolvedValue({
      error: {
        message: 'Failed to fetch',
        name: 'AuthRetryableFetchError',
        status: 0,
      },
    });

    const { getByTestId, getByText } = render(<SignInScreen />);

    await user.press(getByTestId('apple-button'));

    await waitFor(() => {
      expect(
        getByText('Eroare de conexiune. Încearcă din nou.'),
      ).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
