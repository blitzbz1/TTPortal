// T071: real-QueryClient tests — jest.setup's global react-query mock runs
// queryFn eagerly and no-ops the cache, so optimistic updates/rollback were
// untestable. This suite unmocks the library and asserts REAL cache state.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFavoritesQuery,
  useToggleFavoriteMutation,
  favoritesQueryKey,
} from '../useFavoritesQuery';

const mockGetFavorites = jest.fn();
const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();
jest.mock('../../../services/favorites', () => ({
  getFavorites: (...a: any[]) => mockGetFavorites(...a),
  addFavorite: (...a: any[]) => mockAddFavorite(...a),
  removeFavorite: (...a: any[]) => mockRemoveFavorite(...a),
}));

const mockEnqueue = jest.fn();
let mockIsOnline = true;
jest.mock('../../../contexts/OfflineQueueProvider', () => ({
  useOfflineQueue: () => ({ isOnline: mockIsOnline, enqueue: mockEnqueue }),
}));

jest.mock('../../../lib/favoritesCache', () => ({
  loadCachedFavorites: jest.fn(() => null),
  saveCachedFavorites: jest.fn(),
  invalidateFavoritesCache: jest.fn(),
}));

const USER = 'u-1';

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const liveClients: QueryClient[] = [];
function newClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  liveClients.push(client);
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOnline = true;
});

afterEach(() => {
  // Real QueryClients hold subscriptions/timers — clear them so jest exits.
  for (const client of liveClients.splice(0)) {
    client.clear();
    client.unmount();
  }
});

describe('useFavoritesQuery (real cache)', () => {
  it('fetches into the cache under the documented key', async () => {
    const rows = [{ id: 1, venue_id: 42 }];
    mockGetFavorites.mockResolvedValue({ data: rows, error: null });
    const client = newClient();

    const { result } = renderHook(() => useFavoritesQuery(USER), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.data).toEqual(rows));
    expect(client.getQueryData(favoritesQueryKey(USER))).toEqual(rows);
  });
});

describe('useToggleFavoriteMutation (real cache)', () => {
  it('optimistically adds, then leaves the entry after success', async () => {
    mockAddFavorite.mockResolvedValue({ data: { id: 9 }, error: null });
    const client = newClient();
    client.setQueryData(favoritesQueryKey(USER), []);

    const { result } = renderHook(() => useToggleFavoriteMutation(USER), {
      wrapper: wrapperWith(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ venueId: 42, isFav: false });
    });

    const cached = client.getQueryData<any[]>(favoritesQueryKey(USER));
    expect(cached).toEqual([{ venue_id: 42, user_id: USER }]);
    expect(mockAddFavorite).toHaveBeenCalledWith(USER, 42);
  });

  it('rolls the cache back when the server rejects', async () => {
    mockAddFavorite.mockResolvedValue({ data: null, error: { message: 'rls' } });
    const client = newClient();
    const before = [{ venue_id: 7, user_id: USER }];
    client.setQueryData(favoritesQueryKey(USER), before);

    const { result } = renderHook(() => useToggleFavoriteMutation(USER), {
      wrapper: wrapperWith(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ venueId: 42, isFav: false })).rejects.toBeTruthy();
    });

    expect(client.getQueryData(favoritesQueryKey(USER))).toEqual(before);
  });

  it('optimistically removes and keeps the removal after success', async () => {
    mockRemoveFavorite.mockResolvedValue({ data: null, error: null });
    const client = newClient();
    client.setQueryData(favoritesQueryKey(USER), [
      { venue_id: 7, user_id: USER },
      { venue_id: 42, user_id: USER },
    ]);

    const { result } = renderHook(() => useToggleFavoriteMutation(USER), {
      wrapper: wrapperWith(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ venueId: 42, isFav: true });
    });

    expect(client.getQueryData(favoritesQueryKey(USER))).toEqual([{ venue_id: 7, user_id: USER }]);
  });

  it('offline: queues instead of calling the service, keeps the optimistic entry', async () => {
    mockIsOnline = false;
    const client = newClient();
    client.setQueryData(favoritesQueryKey(USER), []);

    const { result } = renderHook(() => useToggleFavoriteMutation(USER), {
      wrapper: wrapperWith(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ venueId: 42, isFav: false });
    });

    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'favorite', operation: 'create' }),
    );
    expect(mockAddFavorite).not.toHaveBeenCalled();
    expect(client.getQueryData(favoritesQueryKey(USER))).toEqual([{ venue_id: 42, user_id: USER }]);
  });
});
