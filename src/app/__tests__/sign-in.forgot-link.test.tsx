import React from 'react';
import { render, userEvent } from '@testing-library/react-native';

// --- Mocks ---

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

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
  }),
  useLocalSearchParams: () => mockSearchParams(),
}));

// eslint-disable-next-line import/first
import SignInScreen from '../sign-in';

describe('SignInScreen — forgot password link (T029)', () => {
  const user = userEvent.setup();

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
    mockSearchParams.mockReturnValue({});
    mockPush.mockReset();
  });

  it('renders "Ai uitat parola?" link on the login tab', async () => {
    mockSearchParams.mockReturnValue({ initialTab: 'login' });
    const { getByTestId, getByText } = render(<SignInScreen />);

    expect(getByTestId('forgot-password-link')).toBeTruthy();
    expect(getByText('Ai uitat parola?')).toBeTruthy();
  });

  it('does not render forgot password link on the signup tab', () => {
    mockSearchParams.mockReturnValue({ initialTab: 'signup' });
    const { queryByTestId } = render(<SignInScreen />);

    expect(queryByTestId('forgot-password-link')).toBeNull();
  });

  it('forgot password link appears after switching from signup to login tab', async () => {
    mockSearchParams.mockReturnValue({});
    const { getByTestId, queryByTestId } = render(<SignInScreen />);

    // Default is signup — no forgot link
    expect(queryByTestId('forgot-password-link')).toBeNull();

    // Switch to login tab
    await user.press(getByTestId('tab-login'));
    expect(getByTestId('forgot-password-link')).toBeTruthy();

    // Switch back to signup — link should disappear
    await user.press(getByTestId('tab-signup'));
    expect(queryByTestId('forgot-password-link')).toBeNull();
  });

  it('tapping the forgot password link navigates to /forgot-password', async () => {
    mockSearchParams.mockReturnValue({ initialTab: 'login' });
    const { getByTestId } = render(<SignInScreen />);

    await user.press(getByTestId('forgot-password-link'));

    expect(mockPush).toHaveBeenCalledWith('/forgot-password');
  });
});
