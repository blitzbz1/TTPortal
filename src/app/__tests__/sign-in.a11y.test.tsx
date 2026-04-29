// --- Mocks (must be defined before component import) ---

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    session: null, user: null, isLoading: false,
    signUp: jest.fn().mockResolvedValue({ error: null }),
    signIn: jest.fn().mockResolvedValue({ error: null }),
    signInWithGoogle: jest.fn().mockResolvedValue({ error: null }),
    signInWithApple: jest.fn().mockResolvedValue({ error: null }),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
  }),
}));
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const map: Record<string, string> = require('../../locales/en.json');
      return map[key] || key;
    },
    lang: 'en' as const, setLang: jest.fn(),
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light', resolved: 'light', isDark: false, setMode: jest.fn(),
  }),
}));

 
import React from 'react';
 
import { render, fireEvent } from '@testing-library/react-native';
 
import SignInScreen from '../sign-in';

describe('SignIn accessibility labels', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submit button has login label on login tab', () => {
    const { getByTestId } = render(<SignInScreen />);
    const btn = getByTestId('submit-button');
    expect(btn.props.accessibilityLabel).toBe('Log in');
  });

  it('submit button has signup label on signup tab', () => {
    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));
    const btn = getByTestId('submit-button');
    expect(btn.props.accessibilityLabel).toBe('Create account');
  });
});
