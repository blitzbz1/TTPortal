import React from 'react';
import { render } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---
// Note: featureFlags is intentionally NOT mocked — this suite asserts the
// real flag value (SOCIAL_AUTH_ENABLED = false) hides the social buttons.

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

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
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

describe('SignInScreen — social auth feature flag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signIn: jest.fn().mockResolvedValue({ error: null }),
      signInWithGoogle: jest.fn().mockResolvedValue({ error: null }),
      signInWithApple: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });
  });

  it('hides Google/Apple buttons while SOCIAL_AUTH_ENABLED is off', () => {
    const { queryByTestId } = render(<SignInScreen />);

    expect(queryByTestId('google-button')).toBeNull();
    expect(queryByTestId('apple-button')).toBeNull();
  });

  it('hides the "or continue with" divider while SOCIAL_AUTH_ENABLED is off', () => {
    const ro: Record<string, string> = require('../../locales/ro.json');
    const { queryByText } = render(<SignInScreen />);

    expect(queryByText(ro.authOrContinueWith)).toBeNull();
  });

  it('email/password form still renders', () => {
    const { getByTestId } = render(<SignInScreen />);

    expect(getByTestId('input-email')).toBeTruthy();
    expect(getByTestId('input-password')).toBeTruthy();
    expect(getByTestId('submit-button')).toBeTruthy();
  });
});
