import React from 'react';
import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockSignIn = jest.fn().mockResolvedValue({ error: null });
const mockSignUp = jest.fn().mockResolvedValue({ error: null });
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

// eslint-disable-next-line import/first
import SignInScreen from '../sign-in';

describe('SignInScreen — login form validation (T016)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: (...a: unknown[]) => mockSignUp(...a),
      signIn: (...a: unknown[]) => mockSignIn(...a),
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams.mockReturnValue({ initialTab: 'login' });
    mockReplace.mockReset();
  });

  it('login tab shows email and password fields (no name field)', () => {
    const { getByTestId, queryByTestId } = render(<SignInScreen />);

    expect(getByTestId('input-email')).toBeTruthy();
    expect(getByTestId('input-password')).toBeTruthy();
    expect(queryByTestId('input-name')).toBeNull();
  });

  it('submit with invalid email shows validation error', async () => {
    const { getByTestId, getByText } = render(<SignInScreen />);

    await user.type(getByTestId('input-email'), 'not-an-email');
    await user.type(getByTestId('input-password'), 'password123');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Email invalid')).toBeTruthy();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('submit with password <8 chars shows validation error', async () => {
    const { getByTestId, getByText } = render(<SignInScreen />);

    await user.type(getByTestId('input-email'), 'test@example.com');
    await user.type(getByTestId('input-password'), 'short');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Minim 8 caractere')).toBeTruthy();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('submit with valid fields calls signIn(email, password)', async () => {
    const { getByTestId } = render(<SignInScreen />);

    await user.type(getByTestId('input-email'), 'john@example.com');
    await user.type(getByTestId('input-password'), 'password123');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        'john@example.com',
        'password123',
      );
    });
  });

  it('tab switcher toggles between signup and login, clears errors on switch', async () => {
    mockSearchParams.mockReturnValue({});
    const { getByTestId, queryByTestId } = render(
      <SignInScreen />,
    );

    // Default is login tab — name field hidden
    expect(queryByTestId('input-name')).toBeNull();

    // Switch to signup tab — name field visible
    fireEvent.press(getByTestId('tab-signup'));
    expect(getByTestId('input-name')).toBeTruthy();

    // Trigger a validation error on signup tab
    await user.type(getByTestId('input-email'), 'bad');
    await user.press(getByTestId('submit-button'));
    await waitFor(() => {
      expect(getByTestId('error-message')).toBeTruthy();
    });

    // Switch to login tab — error should be cleared, name field hidden
    await user.press(getByTestId('tab-login'));
    expect(queryByTestId('input-name')).toBeNull();
    expect(queryByTestId('error-message')).toBeNull();

    // Switch back to signup — name field reappears
    await user.press(getByTestId('tab-signup'));
    expect(getByTestId('input-name')).toBeTruthy();
  });
});
