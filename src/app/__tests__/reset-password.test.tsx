import React from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockExchangeCodeForSession = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...a: unknown[]) =>
        mockExchangeCodeForSession(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
    },
  },
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
let mockSearchParams: Record<string, string> = { code: 'valid-code-123' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a) }),
  useLocalSearchParams: () => mockSearchParams,
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
import ResetPasswordScreen from '../reset-password';

describe('ResetPasswordScreen — T040', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = { code: 'valid-code-123' };
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
    mockReplace.mockReset();
  });

  it('renders with new-password input and confirm button', async () => {
    const { getByTestId } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });
    expect(getByTestId('submit-button')).toBeTruthy();
  });

  it('password <8 chars shows validation error', async () => {
    const { getByTestId, getByText } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    await user.type(getByTestId('input-new-password'), 'short');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Parola trebuie să aibă cel puțin 8 caractere, o literă mare și o cifră')).toBeTruthy();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('successful password update shows success message and navigates to /sign-in', async () => {
    const { getByTestId, getByText } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    await user.type(getByTestId('input-new-password'), 'newPassword123');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Parola a fost actualizată cu succes.')).toBeTruthy();
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: 'newPassword123',
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { initialTab: 'login' },
    });
  });

  it('expired/invalid token shows error with option to request new link', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Token has expired or is invalid',
        code: 'otp_expired',
      },
    });

    const { getByTestId, getByText } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(
        getByText('Link-ul a expirat sau este invalid.'),
      ).toBeTruthy();
    });
    expect(getByTestId('request-new-link')).toBeTruthy();
  });

  it('already-used token shows "already used" message', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Token has already been used',
        code: 'otp_expired',
      },
    });

    const { getByText } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByText('Acest link a fost deja utilizat.')).toBeTruthy();
    });
  });
});
