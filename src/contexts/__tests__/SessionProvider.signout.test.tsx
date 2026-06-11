import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { SessionProvider } from '../SessionProvider';
import { enqueue, getPending, clear } from '../../lib/offlineQueue';
import { queryClient } from '../../lib/queryClient';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

let authCallback: ((event: string, session: unknown) => void) | null = null;
const mockGetSession = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      onAuthStateChange: (cb: any) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

const mockClearEvents = jest.fn();
jest.mock('../../lib/eventsCache', () => ({
  clearAllEventsCacheForUser: (...a: unknown[]) => mockClearEvents(...a),
}));

const mockRemoveByPrefix = jest.fn();
jest.mock('../../lib/cacheUtils', () => ({
  removeCacheItemsByPrefix: (...a: unknown[]) => mockRemoveByPrefix(...a),
}));

const SESSION = { user: { id: 'user-old', email: 'old@example.com' } };

describe('SessionProvider sign-out cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clear();
    mockGetSession.mockResolvedValue({ data: { session: SESSION } });
  });

  afterEach(() => clear());

  it('clears the offline queue, per-user caches, and query cache on SIGNED_OUT', async () => {
    enqueue({ entityType: 'favorite', entityId: 'user-old:1', operation: 'create', payload: {} });
    queryClient.setQueryData(['favorites', 'user-old'], [{ venue_id: 1 }]);

    render(<SessionProvider>{null}</SessionProvider>);
    await waitFor(() => expect(authCallback).not.toBeNull());
    // Let the restored session land in state (and the mirror ref).
    await act(async () => {});

    act(() => {
      authCallback!('SIGNED_OUT', null);
    });

    expect(getPending()).toHaveLength(0);
    expect(mockClearEvents).toHaveBeenCalledWith('user-old');
    expect(mockRemoveByPrefix).toHaveBeenCalledWith('playHistory:user-old:');
    expect(mockRemoveByPrefix).toHaveBeenCalledWith('profile:user-old:');
    expect(queryClient.getQueryData(['favorites', 'user-old'])).toBeUndefined();
  });

  it('does not clear state on other auth events', async () => {
    enqueue({ entityType: 'favorite', entityId: 'user-old:1', operation: 'create', payload: {} });

    render(<SessionProvider>{null}</SessionProvider>);
    await waitFor(() => expect(authCallback).not.toBeNull());
    await act(async () => {});

    act(() => {
      authCallback!('TOKEN_REFRESHED', SESSION);
    });

    expect(getPending()).toHaveLength(1);
    expect(mockClearEvents).not.toHaveBeenCalled();
  });
});
