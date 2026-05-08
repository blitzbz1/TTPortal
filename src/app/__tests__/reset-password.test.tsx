import React from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockExchangeCodeForSession = jest.fn();
const mockUpdateUser = jest.fn();
const mockSetSession = jest.fn();
const mockVerifyOtp = jest.fn();
const mockGetSession = jest.fn();
const mockGetInitialUrl = jest.fn();
const mockSendPasswordChangedEmail = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...a: unknown[]) =>
        mockExchangeCodeForSession(...a),
      setSession: (...a: unknown[]) => mockSetSession(...a),
      verifyOtp: (...a: unknown[]) => mockVerifyOtp(...a),
      getSession: (...a: unknown[]) => mockGetSession(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
    },
  },
}));

jest.mock('expo-linking', () => ({
  getInitialURL: (...a: unknown[]) => mockGetInitialUrl(...a),
  parse: (url: string) => {
    const [schemePath, queryString = ''] = url.split('?');
    return {
      scheme: schemePath.split('://')[0],
      queryParams: Object.fromEntries(new URLSearchParams(queryString).entries()),
    };
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
  useLocalSearchParams: () => ({ ...mockSearchParams }),
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

jest.mock('../../services/securityEmails', () => ({
  sendPasswordChangedEmail: (...a: unknown[]) => mockSendPasswordChangedEmail(...a),
}));

 
import ResetPasswordScreen from '../reset-password';

describe('ResetPasswordScreen — T040', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = { code: 'valid-code-123' };
    mockGetInitialUrl.mockResolvedValue(null);
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    });
    mockSetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockVerifyOtp.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
    mockSendPasswordChangedEmail.mockResolvedValue({ data: { success: true }, error: null });
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

  it('successful password update shows success and security email messages before login', async () => {
    const { getByTestId, getByText } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    await user.type(getByTestId('input-new-password'), 'newPassword123');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Parola a fost actualizată cu succes.')).toBeTruthy();
    });
    expect(getByText('Ți-am trimis și un email de confirmare pentru această schimbare.')).toBeTruthy();
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: 'newPassword123',
    });
    expect(mockSendPasswordChangedEmail).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();

    await user.press(getByTestId('continue-to-login'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { initialTab: 'login' },
    });
  });

  it('still shows password reset success if the security email cannot be sent', async () => {
    mockSendPasswordChangedEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'Email failed', code: 'email_failed', status: 500 },
    });

    const { getByTestId, getByText, queryByTestId } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    await user.type(getByTestId('input-new-password'), 'newPassword123');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Parola a fost actualizată cu succes.')).toBeTruthy();
    });
    expect(queryByTestId('security-email-message')).toBeNull();
  });

  it('shows a friendly message when Supabase rejects reusing the old password', async () => {
    mockUpdateUser.mockResolvedValueOnce({
      data: {},
      error: {
        code: 'same_password',
        message: 'New password should be different from the old password',
        status: 422,
      },
    });

    const { getByTestId, getByText } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    await user.type(getByTestId('input-new-password'), 'newPassword123');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Parola nouă trebuie să fie diferită de parola veche.')).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a friendly message when the reset session expires before update', async () => {
    mockUpdateUser.mockResolvedValueOnce({
      data: {},
      error: {
        code: 'session_not_found',
        message: 'Auth session missing',
        status: 401,
      },
    });

    const { getByTestId, getByText } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    await user.type(getByTestId('input-new-password'), 'newPassword123');
    await user.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('Sesiunea de resetare a expirat. Solicită un link nou și încearcă din nou.')).toBeTruthy();
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

  it('accepts recovery tokens from the callback URL fragment', async () => {
    mockSearchParams = {};
    mockGetInitialUrl.mockResolvedValue(
      'ttportal://reset-password#access_token=access-123&refresh_token=refresh-123',
    );

    const { getByTestId } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-123',
      refresh_token: 'refresh-123',
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('accepts Supabase recovery token_hash links', async () => {
    mockSearchParams = {
      token_hash: 'recovery-token-hash',
      type: 'recovery',
    };

    const { getByTestId } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: 'recovery-token-hash',
      type: 'recovery',
    });
    expect(mockGetSession).toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('shows expired state when token_hash verification returns no session', async () => {
    mockSearchParams = {
      token_hash: 'recovery-token-hash',
      type: 'recovery',
    };
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const { getByTestId } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('token-expired')).toBeTruthy();
    });
  });

  it('does not verify the same one-time recovery token twice across rerenders', async () => {
    mockSearchParams = {
      token_hash: 'recovery-token-hash',
      type: 'recovery',
    };

    const { getByTestId, rerender } = render(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(getByTestId('input-new-password')).toBeTruthy();
    });

    rerender(<ResetPasswordScreen />);

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    });
  });
});
