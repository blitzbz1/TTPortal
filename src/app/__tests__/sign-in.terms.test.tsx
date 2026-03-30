import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, userEvent } from '@testing-library/react-native';

// --- Mocks ---

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    session: null,
    user: null,
    isLoading: false,
    signUp: jest.fn().mockResolvedValue({ error: null }),
    signIn: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
  }),
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

const mockSearchParams = jest.fn().mockReturnValue({});

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
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

jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

describe('SignInScreen — Terms and Privacy links (T042)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.mockReturnValue({});
    (Linking.openURL as jest.Mock).mockResolvedValue(true);
  });

  it('renders terms and privacy links on signup tab', () => {
    const { getByTestId, getByText } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    expect(getByTestId('terms-container')).toBeTruthy();
    expect(getByText('Termenii și condițiile')).toBeTruthy();
    expect(getByText('Politica de confidențialitate')).toBeTruthy();
  });

  it('does not render terms links on login tab', async () => {
    mockSearchParams.mockReturnValue({ initialTab: 'login' });
    const { queryByTestId } = render(<SignInScreen />);

    expect(queryByTestId('terms-container')).toBeNull();
  });

  it('hides terms links when switching from signup to login tab', async () => {
    const { getByTestId, queryByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    // On signup tab — terms visible
    expect(getByTestId('terms-container')).toBeTruthy();

    // Switch to login tab
    await user.press(getByTestId('tab-login'));

    expect(queryByTestId('terms-container')).toBeNull();
  });

  it('shows terms links when switching from login to signup tab', async () => {
    mockSearchParams.mockReturnValue({ initialTab: 'login' });
    const { getByTestId, queryByTestId } = render(<SignInScreen />);

    // Initially on login tab — terms hidden
    expect(queryByTestId('terms-container')).toBeNull();

    // Switch to signup tab
    await user.press(getByTestId('tab-signup'));

    expect(getByTestId('terms-container')).toBeTruthy();
  });

  it('opens Terms of Service URL when tapping terms link', async () => {
    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await user.press(getByTestId('terms-link'));

    expect(Linking.openURL).toHaveBeenCalledWith('https://ttportal.ro/terms');
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });

  it('opens Privacy Policy URL when tapping privacy link', async () => {
    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await user.press(getByTestId('privacy-link'));

    expect(Linking.openURL).toHaveBeenCalledWith('https://ttportal.ro/privacy');
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });
});
