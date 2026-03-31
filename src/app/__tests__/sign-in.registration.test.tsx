import React from 'react';
import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

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

describe('SignInScreen — registration form validation (T012)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: (...a: unknown[]) => mockSignUp(...a),
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams.mockReturnValue({});
    mockReplace.mockReset();
  });

  it('signup tab shows name, email, password fields', () => {
    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    expect(getByTestId('input-name')).toBeTruthy();
    expect(getByTestId('input-email')).toBeTruthy();
    expect(getByTestId('input-password')).toBeTruthy();
  });

  it('submit with empty name shows "Numele este obligatoriu" error', async () => {
    const { getByTestId, getByText } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    // Fill email and password but leave name empty
    await user.type(getByTestId('input-email'), 'test@example.com');
    await user.type(getByTestId('input-password'), 'Password1');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Numele este obligatoriu')).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('submit with invalid email shows "Email invalid" error', async () => {
    const { getByTestId, getByText } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await user.type(getByTestId('input-name'), 'John Doe');
    await user.type(getByTestId('input-email'), 'not-an-email');
    await user.type(getByTestId('input-password'), 'Password1');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Email invalid')).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('submit with password <8 chars shows "Minim 8 caractere" error', async () => {
    const { getByTestId, getByText } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await user.type(getByTestId('input-name'), 'John Doe');
    await user.type(getByTestId('input-email'), 'test@example.com');
    await user.type(getByTestId('input-password'), 'short');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Parola trebuie să aibă cel puțin 8 caractere, o literă mare și o cifră')).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('submit with all valid fields calls signUp(name, email, password)', async () => {
    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await user.type(getByTestId('input-name'), 'John Doe');
    await user.type(getByTestId('input-email'), 'john@example.com');
    await user.type(getByTestId('input-password'), 'Password1');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'John Doe',
        'john@example.com',
        'Password1',
      );
    });
  });

  it('password visibility toggle switches between secure and plain text', async () => {
    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    const passwordInput = getByTestId('input-password');
    const toggleButton = getByTestId('toggle-password');

    // Initially secure (password hidden)
    expect(passwordInput.props.secureTextEntry).toBe(true);

    // Toggle to visible
    await user.press(toggleButton);
    expect(getByTestId('input-password').props.secureTextEntry).toBe(false);

    // Toggle back to hidden
    await user.press(toggleButton);
    expect(getByTestId('input-password').props.secureTextEntry).toBe(true);
  });
});
