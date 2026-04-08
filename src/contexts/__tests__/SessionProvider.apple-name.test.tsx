import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let authCallback: AuthCallback | null = null;

const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
  error: null,
});

const mockSignInWithIdToken = jest.fn();
const mockUpdateUser = jest.fn().mockResolvedValue({
  data: { user: null },
  error: null,
});
const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: any[]) => mockGetSession(...a),
      signUp: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signInWithIdToken: (...a: any[]) => mockSignInWithIdToken(...a),
      signInWithOAuth: jest.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: (...a: any[]) => mockUpdateUser(...a),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
      onAuthStateChange: (...a: any[]) => {
        authCallback = a[0] as AuthCallback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
    from: () => ({ upsert: (...a: any[]) => mockUpsert(...a) }),
  },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
  },
}));

const mockAppleSignIn = jest.fn();

jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...a: any[]) => mockAppleSignIn(...a),
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

 
import React from 'react';
 
import { Text, Pressable } from 'react-native';
 
import { render, screen, act, waitFor, userEvent } from '@testing-library/react-native';
 
import { SessionProvider } from '../SessionProvider';
 
import { useSession } from '../../hooks/useSession';

const fakeUser: User = {
  id: 'apple-user-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'apple@privaterelay.appleid.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'apple', providers: ['apple'] },
  user_metadata: { full_name: 'Maria Popescu' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const fakeSession: Session = {
  access_token: 'access-token-apple',
  refresh_token: 'refresh-token-apple',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: fakeUser,
};

function AppleNameTestConsumer() {
  const ctx = useSession();
  return (
    <>
      <Text testID="isLoading">{String(ctx.isLoading)}</Text>
      <Pressable testID="apple" onPress={() => ctx.signInWithApple()}>
        <Text>Apple</Text>
      </Pressable>
    </>
  );
}

describe('SessionProvider — Apple name capture edge case', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authCallback = null;
    jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('first Apple sign-in with fullName updates user_metadata and profiles.full_name', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token-first',
      fullName: { givenName: 'Maria', familyName: 'Popescu' },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    const user = userEvent.setup();
    render(
      <SessionProvider>
        <AppleNameTestConsumer />
      </SessionProvider>,
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await user.press(screen.getByTestId('apple'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { full_name: 'Maria Popescu' },
      });
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        id: 'apple-user-123',
        full_name: 'Maria Popescu',
        email: 'apple@privaterelay.appleid.com',
        auth_provider: 'apple',
      },
      { onConflict: 'id' },
    );
  });

  it('first Apple sign-in with only givenName updates name correctly', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token-given-only',
      fullName: { givenName: 'Ion', familyName: null },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    const user = userEvent.setup();
    render(
      <SessionProvider>
        <AppleNameTestConsumer />
      </SessionProvider>,
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await user.press(screen.getByTestId('apple'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { full_name: 'Ion' },
      });
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'Ion' }),
      { onConflict: 'id' },
    );
  });

  it('repeat Apple sign-in with fullName null skips user_metadata update', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token-repeat',
      fullName: null,
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    const user = userEvent.setup();
    render(
      <SessionProvider>
        <AppleNameTestConsumer />
      </SessionProvider>,
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await user.press(screen.getByTestId('apple'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('repeat Apple sign-in with fullName null does not include full_name in profile upsert', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token-repeat-profile',
      fullName: null,
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    const user = userEvent.setup();
    render(
      <SessionProvider>
        <AppleNameTestConsumer />
      </SessionProvider>,
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await user.press(screen.getByTestId('apple'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: 'apple-user-123',
          email: 'apple@privaterelay.appleid.com',
          auth_provider: 'apple',
        },
        { onConflict: 'id' },
      );
    });

    // Verify full_name key is NOT present in the upsert data
    const upsertData = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(upsertData)).not.toContain('full_name');
  });

  it('repeat Apple sign-in with empty fullName fields skips name update', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token-empty-names',
      fullName: { givenName: null, familyName: null },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    const user = userEvent.setup();
    render(
      <SessionProvider>
        <AppleNameTestConsumer />
      </SessionProvider>,
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await user.press(screen.getByTestId('apple'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();

    const upsertData = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(upsertData)).not.toContain('full_name');
  });
});
