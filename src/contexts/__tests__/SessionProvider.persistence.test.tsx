import type { Session, User } from '@supabase/supabase-js';

const mockUnsubscribe = jest.fn();

const mockGetSession = jest.fn().mockResolvedValue({
  data: { session: null },
  error: null,
});

const mockOnAuthStateChange = jest.fn(() => {
  return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
});

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
      onAuthStateChange: (...a: unknown[]) => mockOnAuthStateChange(...a),
    },
  },
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
import { Text } from 'react-native';
// eslint-disable-next-line import/first
import { render, screen, waitFor } from '@testing-library/react-native';
// eslint-disable-next-line import/first
import { SessionProvider } from '../SessionProvider';
// eslint-disable-next-line import/first
import { useSession } from '../../hooks/useSession';

const fakeUser: User = {
  id: 'user-persist-001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'persist@example.com',
  email_confirmed_at: '2026-01-15T10:00:00Z',
  phone: '',
  confirmed_at: '2026-01-15T10:00:00Z',
  last_sign_in_at: '2026-03-20T08:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Persisted User' },
  identities: [],
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-03-20T08:00:00Z',
};

const fakeSession: Session = {
  access_token: 'persisted-access-token-abc',
  refresh_token: 'persisted-refresh-token-xyz',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: fakeUser,
};

function PersistenceConsumer() {
  const ctx = useSession();
  return (
    <>
      <Text testID="isLoading">{String(ctx.isLoading)}</Text>
      <Text testID="session">{ctx.session ? 'has-session' : 'no-session'}</Text>
      <Text testID="accessToken">{ctx.session?.access_token ?? 'none'}</Text>
      <Text testID="userEmail">{ctx.user?.email ?? 'no-user'}</Text>
      <Text testID="userName">
        {ctx.user?.user_metadata?.full_name ?? 'no-name'}
      </Text>
    </>
  );
}

describe('SessionProvider — session persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('restores a stored session from expo-sqlite on mount', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    // Initially loading
    expect(screen.getByTestId('isLoading')).toHaveTextContent('true');

    // After getSession resolves, session is restored
    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('has-session');
    expect(screen.getByTestId('accessToken')).toHaveTextContent(
      'persisted-access-token-abc',
    );
    expect(screen.getByTestId('userEmail')).toHaveTextContent(
      'persist@example.com',
    );
    expect(screen.getByTestId('userName')).toHaveTextContent('Persisted User');
  });

  it('calls supabase.auth.getSession on mount to check stored session', async () => {
    render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('session survives a simulated app restart (unmount + remount)', async () => {
    // Simulate: storage always returns the same persisted session
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    // First mount — initial app open
    const { unmount } = render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('has-session');
    expect(screen.getByTestId('userEmail')).toHaveTextContent(
      'persist@example.com',
    );

    // Simulate app close
    unmount();

    // Verify cleanup ran
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

    // Clear mocks to reset call counts for the second mount
    jest.clearAllMocks();

    // Simulate app reopen — storage still has session
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    // Should start loading again on fresh mount
    expect(screen.getByTestId('isLoading')).toHaveTextContent('true');

    // Session restored again from storage
    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('has-session');
    expect(screen.getByTestId('accessToken')).toHaveTextContent(
      'persisted-access-token-abc',
    );
    expect(screen.getByTestId('userEmail')).toHaveTextContent(
      'persist@example.com',
    );
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('session is null after restart when storage has no session', async () => {
    // First mount — user has a session via onAuthStateChange
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { unmount } = render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('no-session');

    unmount();
    jest.clearAllMocks();

    // Second mount — storage still empty
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('session')).toHaveTextContent('no-session');
    expect(screen.getByTestId('userEmail')).toHaveTextContent('no-user');
  });

  it('subscribes to onAuthStateChange on each mount after restart', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    // First mount
    const { unmount } = render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    // Second mount — re-subscribes
    render(
      <SessionProvider>
        <PersistenceConsumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });
});
