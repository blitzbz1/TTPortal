import type { Session, User } from '@supabase/supabase-js';

const mockUnsubscribe = jest.fn();

const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
  error: null,
});

const mockSignInWithIdToken = jest.fn();

const mockOnAuthStateChange = jest.fn(
  () => {
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
  },
);

const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithIdToken: (...a: unknown[]) => mockSignInWithIdToken(...a),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
      onAuthStateChange: (...a: Parameters<typeof mockOnAuthStateChange>) => mockOnAuthStateChange(...a),
    },
    from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a) }),
  },
}));

const mockGoogleSignIn = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: (...a: unknown[]) => mockGoogleSignIn(...a),
    hasPlayServices: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import React from 'react';
// eslint-disable-next-line import/first
import { Text, Pressable } from 'react-native';
// eslint-disable-next-line import/first
import { render, screen, act, waitFor, userEvent } from '@testing-library/react-native';
// eslint-disable-next-line import/first
import { SessionProvider } from '../SessionProvider';
// eslint-disable-next-line import/first
import { useSession } from '../../hooks/useSession';
// eslint-disable-next-line import/first
import { logger } from '../../lib/logger';

/**
 * User who originally registered with email, now signing in with Google.
 * Has both email and google identities after linking.
 */
const linkedUser: User = {
  id: 'user-existing-email',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'existing@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-03-26T10:00:00Z',
  app_metadata: { provider: 'google', providers: ['email', 'google'] },
  user_metadata: { full_name: 'Existing User' },
  identities: [
    {
      identity_id: 'id-email',
      id: 'user-existing-email',
      user_id: 'user-existing-email',
      identity_data: { email: 'existing@example.com' },
      provider: 'email',
      last_sign_in_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      identity_id: 'id-google',
      id: 'google-sub-123',
      user_id: 'user-existing-email',
      identity_data: { email: 'existing@example.com', full_name: 'Existing User' },
      provider: 'google',
      last_sign_in_at: '2026-03-26T10:00:00Z',
      created_at: '2026-03-26T10:00:00Z',
      updated_at: '2026-03-26T10:00:00Z',
    },
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-26T10:00:00Z',
};

const linkedSession: Session = {
  access_token: 'access-linked-123',
  refresh_token: 'refresh-linked-123',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: linkedUser,
};

const googleSignInSuccessResult = {
  type: 'success' as const,
  data: {
    idToken: 'google-id-token-link',
    user: {
      id: 'google-sub-123',
      email: 'existing@example.com',
      name: 'Existing User',
      givenName: 'Existing',
      familyName: 'User',
      photo: null,
    },
    accessToken: 'at-link',
    serverAuthCode: null,
    scopes: ['email'],
  },
};

function GoogleLinkConsumer() {
  const ctx = useSession();
  return (
    <>
      <Text testID="isLoading">{String(ctx.isLoading)}</Text>
      <Text testID="session">{ctx.session ? 'has-session' : 'no-session'}</Text>
      <Text testID="userId">{ctx.user?.id ?? 'no-user'}</Text>
      <Pressable testID="google" onPress={() => ctx.signInWithGoogle()}>
        <Text>Google</Text>
      </Pressable>
    </>
  );
}

describe('SessionProvider — Google-to-email account linking', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('upserts profile with auth_provider google when email user signs in with Google', async () => {
    mockGoogleSignIn.mockResolvedValue(googleSignInSuccessResult);
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: linkedUser, session: linkedSession },
      error: null,
    });

    render(<SessionProvider><GoogleLinkConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: 'user-existing-email',
        full_name: 'Existing User',
        email: 'existing@example.com',
        auth_provider: 'google',
      },
      { onConflict: 'id' },
    );
  });

  it('uses onConflict id to update existing profile row instead of duplicating', async () => {
    mockGoogleSignIn.mockResolvedValue(googleSignInSuccessResult);
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: linkedUser, session: linkedSession },
      error: null,
    });

    render(<SessionProvider><GoogleLinkConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    const upsertCall = mockUpsert.mock.calls[0];
    expect(upsertCall[1]).toEqual({ onConflict: 'id' });
  });

  it('preserves the same user ID for a linked account', async () => {
    mockGoogleSignIn.mockResolvedValue(googleSignInSuccessResult);
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: linkedUser, session: linkedSession },
      error: null,
    });

    render(<SessionProvider><GoogleLinkConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    const upsertData = mockUpsert.mock.calls[0][0];
    expect(upsertData.id).toBe('user-existing-email');
  });

  it('logs account linking when user has both email and google identities', async () => {
    mockGoogleSignIn.mockResolvedValue(googleSignInSuccessResult);
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: linkedUser, session: linkedSession },
      error: null,
    });

    render(<SessionProvider><GoogleLinkConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(
        'Google account linked to existing email account',
        { userId: 'user-existing-email', providers: ['email', 'google'] },
      );
    });
  });

  it('does not log account linking for a fresh Google-only user', async () => {
    const freshGoogleUser: User = {
      id: 'user-google-only',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'newgoogle@example.com',
      email_confirmed_at: '2026-03-26T10:00:00Z',
      phone: '',
      confirmed_at: '2026-03-26T10:00:00Z',
      last_sign_in_at: '2026-03-26T10:00:00Z',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'New Google User' },
      identities: [
        {
          identity_id: 'id-google-only',
          id: 'google-sub-fresh',
          user_id: 'user-google-only',
          identity_data: { email: 'newgoogle@example.com' },
          provider: 'google',
          last_sign_in_at: '2026-03-26T10:00:00Z',
          created_at: '2026-03-26T10:00:00Z',
          updated_at: '2026-03-26T10:00:00Z',
        },
      ],
      created_at: '2026-03-26T10:00:00Z',
      updated_at: '2026-03-26T10:00:00Z',
    };

    const freshSession: Session = {
      access_token: 'access-fresh',
      refresh_token: 'refresh-fresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: freshGoogleUser,
    };

    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id-token-fresh',
        user: {
          id: 'google-sub-fresh',
          email: 'newgoogle@example.com',
          name: 'New Google User',
          givenName: 'New',
          familyName: 'Google User',
          photo: null,
        },
        accessToken: 'at-fresh',
        serverAuthCode: null,
        scopes: ['email'],
      },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: freshGoogleUser, session: freshSession },
      error: null,
    });

    render(<SessionProvider><GoogleLinkConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    expect(logger.info).not.toHaveBeenCalledWith(
      'Google account linked to existing email account',
      expect.anything(),
    );
  });

  it('updates auth_provider to google even when profile upsert uses existing user id', async () => {
    mockGoogleSignIn.mockResolvedValue(googleSignInSuccessResult);
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: linkedUser, session: linkedSession },
      error: null,
    });

    render(<SessionProvider><GoogleLinkConsumer /></SessionProvider>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await user.press(screen.getByTestId('google'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    const upsertData = mockUpsert.mock.calls[0][0];
    expect(upsertData.auth_provider).toBe('google');
    expect(upsertData.email).toBe('existing@example.com');
    expect(upsertData.full_name).toBe('Existing User');
  });
});
