import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {
  code: 'pkce-code-123',
  flow: 'oauth',
  next: '/(tabs)',
};

const mockExchangeCodeForSession = jest.fn();
const mockVerifyOtp = jest.fn();
const mockGetSession = jest.fn();
const mockSetSession = jest.fn();
const mockGetInitialUrl = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...args: unknown[]) => mockReplace(...args) }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const ro: Record<string, string> = require('../../locales/ro.json');
      return ro[key] || key;
    },
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
  }),
}));

jest.mock('expo-linking', () => ({
  getInitialURL: (...args: unknown[]) => mockGetInitialUrl(...args),
  parse: (url: string) => {
    const [schemePath, queryString = ''] = url.split('?');
    return {
      scheme: schemePath.split('://')[0],
      queryParams: Object.fromEntries(new URLSearchParams(queryString).entries()),
    };
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
    },
  },
}));

import AuthCallbackScreen from '../auth/callback';

describe('AuthCallbackScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {
      code: 'pkce-code-123',
      flow: 'oauth',
      next: '/(tabs)',
    };
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    });
    mockSetSession.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    });
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    });
    mockGetInitialUrl.mockResolvedValue(null);
  });

  it('completes PKCE code callbacks and routes to the next screen', async () => {
    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-code-123');
    });
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('verifies signup confirmation links that use token_hash callbacks', async () => {
    mockSearchParams = {
      token_hash: 'signup-token-hash',
      type: 'signup',
      flow: 'signup',
      next: '/onboarding',
    };

    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'signup-token-hash',
        type: 'signup',
      });
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/onboarding');
  });

  it('falls back to sign-in when signup verification succeeds without restoring a session', async () => {
    mockSearchParams = {
      token_hash: 'signup-token-hash',
      type: 'signup',
      flow: 'signup',
      next: '/onboarding',
    };
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: null },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/sign-in',
        params: { initialTab: 'login' },
      });
    });
  });

  it('reads signup callback errors from the URL fragment and shows an expired-link state', async () => {
    mockSearchParams = {};
    mockGetInitialUrl.mockResolvedValue(
      'https://www.ttportal.org/TTPortal/app/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=?next=%2Fonboarding&flow=signup',
    );

    const { getByTestId, getByText } = render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(getByTestId('auth-callback-expired')).toBeTruthy();
    });
    expect(
      getByText('Link-ul de confirmare a expirat sau este invalid. Solicită un email nou și încearcă din nou.'),
    ).toBeTruthy();
  });
});
