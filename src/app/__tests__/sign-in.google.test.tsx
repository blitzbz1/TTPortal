import React from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockSignInWithGoogle = jest.fn();
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

 
import SignInScreen from '../sign-in';

describe('SignInScreen — Google Sign-In (T021)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithGoogle.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signIn: jest.fn().mockResolvedValue({ error: null }),
      signInWithGoogle: (...a: unknown[]) => mockSignInWithGoogle(...a),
      signInWithApple: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams.mockReturnValue({});
    mockReplace.mockReset();
  });

  it('Google button renders on auth screen', () => {
    const { getByTestId } = render(<SignInScreen />);

    expect(getByTestId('google-button')).toBeTruthy();
  });

  it('tapping Google button calls signInWithGoogle', async () => {
    const { getByTestId } = render(<SignInScreen />);

    await user.press(getByTestId('google-button'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('successful Google auth navigates to map', async () => {
    const { getByTestId } = render(<SignInScreen />);

    await user.press(getByTestId('google-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('Google auth failure shows localized error message', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      error: {
        message: 'Failed to fetch',
        name: 'AuthRetryableFetchError',
        status: 0,
      },
    });

    const { getByTestId, getByText } = render(<SignInScreen />);

    await user.press(getByTestId('google-button'));

    await waitFor(() => {
      expect(
        getByText('Eroare de conexiune. Încearcă din nou.'),
      ).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('loading state during Google flow disables all auth buttons', async () => {
    let resolveGoogle!: (value: { error: null }) => void;
    mockSignInWithGoogle.mockReturnValue(
      new Promise<{ error: null }>((resolve) => {
        resolveGoogle = resolve;
      }),
    );

    const { getByTestId } = render(<SignInScreen />);

    // Press Google button — signInWithGoogle is now pending
    await user.press(getByTestId('google-button'));

    // All auth buttons should be disabled while loading
    await waitFor(() => {
      expect(
        getByTestId('submit-button').props.accessibilityState?.disabled,
      ).toBe(true);
      expect(
        getByTestId('google-button').props.accessibilityState?.disabled,
      ).toBe(true);
      expect(
        getByTestId('apple-button').props.accessibilityState?.disabled,
      ).toBe(true);
    });

    // Resolve the Google sign-in promise
    await waitFor(async () => {
      resolveGoogle({ error: null });
    });

    // Buttons should be re-enabled
    await waitFor(() => {
      expect(
        getByTestId('google-button').props.accessibilityState?.disabled ?? false,
      ).toBe(false);
    });
  });
});
