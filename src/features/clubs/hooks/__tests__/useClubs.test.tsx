// Real-QueryClient tests for the clubs domain hooks (F040). jest.setup's
// global react-query mock runs queryFn eagerly and no-ops the cache, so we
// unmock the library to assert REAL cache state + invalidation.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMyClubsQuery,
  useCreateClub,
  useJoinClub,
  useLeaveClub,
  myClubsQueryKey,
} from '../useClubs';

const mockGetMyClubs = jest.fn();
const mockLoadCachedClubs: jest.Mock = jest.fn(() => null);
const mockCreateClub = jest.fn();
const mockJoinClubByCode = jest.fn();
const mockLeaveClub = jest.fn();
jest.mock('../../../../services/clubs', () => ({
  getMyClubs: (...a: any[]) => mockGetMyClubs(...a),
  getClubDetail: jest.fn(),
  createClub: (...a: any[]) => mockCreateClub(...a),
  joinClubByCode: (...a: any[]) => mockJoinClubByCode(...a),
  leaveClub: (...a: any[]) => mockLeaveClub(...a),
  removeClubMember: jest.fn(),
  rotateClubJoinCode: jest.fn(),
}));

jest.mock('../../../../lib/clubsCache', () => ({
  loadCachedClubs: (userId: string) => mockLoadCachedClubs(userId),
  saveCachedClubs: jest.fn(),
  invalidateClubsCache: jest.fn(),
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
  mockLoadCachedClubs.mockReturnValue(null);
});
afterEach(() => {
  for (const client of liveClients.splice(0)) {
    client.clear();
    client.unmount();
  }
});

describe('useMyClubsQuery (F040)', () => {
  it('fetches into the cache under the documented key', async () => {
    const rows = [{ id: 1, name: 'A', role: 'admin', member_count: 2 }];
    mockGetMyClubs.mockResolvedValue({ data: rows, error: null });
    const client = newClient();

    const { result } = renderHook(() => useMyClubsQuery(USER), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.data).toEqual(rows));
    expect(client.getQueryData(myClubsQueryKey(USER))).toEqual(rows);
  });

  it('is disabled with no user', () => {
    const client = newClient();
    const { result } = renderHook(() => useMyClubsQuery(undefined), { wrapper: wrapperWith(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetMyClubs).not.toHaveBeenCalled();
  });

  it('revalidates a cached empty list so cross-device joins appear', async () => {
    const rows = [{ id: 23, name: 'Team 23', role: 'member', member_count: 2 }];
    mockLoadCachedClubs.mockReturnValue({ data: [], fresh: true });
    mockGetMyClubs.mockResolvedValue({ data: rows, error: null });
    const client = newClient();

    const { result } = renderHook(() => useMyClubsQuery(USER), { wrapper: wrapperWith(client) });

    expect(result.current.data).toEqual([]);
    await waitFor(() => expect(result.current.data).toEqual(rows));
    expect(mockGetMyClubs).toHaveBeenCalledTimes(1);
  });
});

describe('club mutations invalidate the clubs root (F040)', () => {
  it('useCreateClub invalidates after success', async () => {
    mockCreateClub.mockResolvedValue({ data: 42, error: null });
    const client = newClient();
    const spy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateClub(), { wrapper: wrapperWith(client) });
    await act(async () => {
      const id = await result.current.mutateAsync({ name: 'New' });
      expect(id).toBe(42);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['clubs'], exact: false });
  });

  it('useJoinClub returns the club id and invalidates', async () => {
    mockJoinClubByCode.mockResolvedValue({ data: 7, error: null });
    const client = newClient();
    const spy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useJoinClub(), { wrapper: wrapperWith(client) });
    await act(async () => {
      const id = await result.current.mutateAsync('ABC123');
      expect(id).toBe(7);
    });
    expect(mockJoinClubByCode).toHaveBeenCalledWith('ABC123');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['clubs'], exact: false });
  });

  it('useLeaveClub throws on error and still invalidates', async () => {
    mockLeaveClub.mockResolvedValue({ data: null, error: { message: 'last_admin_cannot_leave' } });
    const client = newClient();
    const spy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useLeaveClub(), { wrapper: wrapperWith(client) });
    await act(async () => {
      await expect(result.current.mutateAsync(5)).rejects.toBeTruthy();
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['clubs'], exact: false });
  });
});
