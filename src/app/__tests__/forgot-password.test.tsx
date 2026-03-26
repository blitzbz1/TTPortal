import React from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockResetPassword = jest.fn().mockResolvedValue({ error: null });
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

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a) }),
}));

// eslint-disable-next-line import/first
import ForgotPasswordScreen from '../forgot-password';

describe('ForgotPasswordScreen — T027', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockResetPassword.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      signOut: jest.fn(),
      resetPassword: (...a: unknown[]) => mockResetPassword(...a),
    });
    mockReplace.mockReset();
  });

  it('renders with email input and submit button', () => {
    const { getByTestId } = render(<ForgotPasswordScreen />);

    expect(getByTestId('input-email')).toBeTruthy();
    expect(getByTestId('submit-button')).toBeTruthy();
  });

  it('submit with invalid email shows validation error', async () => {
    const { getByTestId, getByText } = render(<ForgotPasswordScreen />);

    await user.type(getByTestId('input-email'), 'not-an-email');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Email invalid')).toBeTruthy();
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('successful submission shows success message', async () => {
    const { getByTestId, getByText } = render(<ForgotPasswordScreen />);

    await user.type(getByTestId('input-email'), 'user@example.com');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(
        getByText(
          'Verifică inbox-ul și folderul spam. Link-ul expiră în 60 de minute.',
        ),
      ).toBeTruthy();
    });
    expect(mockResetPassword).toHaveBeenCalledWith('user@example.com');
  });

  it('shows same success message for non-existent email (enumeration protection)', async () => {
    mockResetPassword.mockRejectedValueOnce(new Error('User not found'));

    const { getByTestId, getByText } = render(<ForgotPasswordScreen />);

    await user.type(getByTestId('input-email'), 'nonexistent@example.com');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(
        getByText(
          'Verifică inbox-ul și folderul spam. Link-ul expiră în 60 de minute.',
        ),
      ).toBeTruthy();
    });
    expect(getByTestId('success-message')).toBeTruthy();
  });

  it('"Înapoi la conectare" link navigates to /sign-in with initialTab: login', async () => {
    const { getByTestId } = render(<ForgotPasswordScreen />);

    await user.press(getByTestId('back-to-login'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { initialTab: 'login' },
    });
  });

  it('loading state disables submit during request', async () => {
    let resolveReset: (value: { error: null }) => void;
    mockResetPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReset = resolve;
        }),
    );

    const { getByTestId } = render(<ForgotPasswordScreen />);

    await user.type(getByTestId('input-email'), 'user@example.com');
    await user.press(getByTestId('submit-button'));

    // While request is in flight, submit button should be disabled
    await waitFor(() => {
      expect(getByTestId('submit-button').props.accessibilityState?.disabled).toBe(true);
    });
    expect(getByTestId('loading-spinner')).toBeTruthy();

    // Resolve the pending request
    resolveReset!({ error: null });

    // After resolution, success message should appear
    await waitFor(() => {
      expect(getByTestId('success-message')).toBeTruthy();
    });
  });
});
