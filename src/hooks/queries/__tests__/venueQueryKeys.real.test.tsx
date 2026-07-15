// T071: key-correctness for venue queries against a REAL QueryClient —
// the invariants that matter: account switches re-key venue-detail, the
// invalidation helper hits every user variant of a venue, and the offline
// fallback synthesizes a fromCache bundle instead of erroring.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVenueDetailQuery, venueDetailQueryKey, useInvalidateVenueDetail } from '../useVenueDetailQuery';

const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...a: any[]) => mockRpc(...a) },
}));

const mockLoadMeta = jest.fn();
const mockLoadReviews = jest.fn();
jest.mock('../../../lib/venueDetailCache', () => ({
  saveCachedVenueMeta: jest.fn(),
  saveCachedVenueReviews: jest.fn(),
  loadCachedVenueMeta: (...a: any[]) => mockLoadMeta(...a),
  loadCachedVenueReviews: (...a: any[]) => mockLoadReviews(...a),
}));

const liveClients: QueryClient[] = [];
function newClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  liveClients.push(client);
  return client;
}
function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  for (const client of liveClients.splice(0)) {
    client.clear();
    client.unmount();
  }
});

describe('venueDetailQueryKey', () => {
  it('keys on venue AND user so account switches never share a bundle', () => {
    expect(venueDetailQueryKey(42, 'u-1')).toEqual(['venue-detail', 42, 'u-1']);
    expect(venueDetailQueryKey(42, undefined)).toEqual(['venue-detail', 42, null]);
    expect(venueDetailQueryKey(42, 'u-1')).not.toEqual(venueDetailQueryKey(42, 'u-2'));
  });
});

describe('useVenueDetailQuery (real cache)', () => {
  it('stores the bundle under the documented key', async () => {
    const bundle = { venue: { id: 42, name: 'X' }, stats: null, recent_reviews: [] };
    mockRpc.mockResolvedValue({ data: bundle, error: null });
    const client = newClient();

    const { result } = renderHook(() => useVenueDetailQuery(42, 'u-1'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(client.getQueryData(venueDetailQueryKey(42, 'u-1'))).toEqual(bundle);
  });

  it('falls back to a fromCache bundle when the RPC fails and cache exists', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    mockLoadMeta.mockReturnValue({ data: { venue: { id: 42, name: 'Cached' }, stats: null } });
    mockLoadReviews.mockReturnValue({ data: [{ id: 1 }] });
    const client = newClient();

    const { result } = renderHook(() => useVenueDetailQuery(42, 'u-1'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data).toEqual(
      expect.objectContaining({
        fromCache: true,
        is_favorited: false,
        recent_reviews: [{ id: 1 }],
      }),
    );
  });

  it('errors when the RPC fails and nothing is cached', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    mockLoadMeta.mockReturnValue(null);
    const client = newClient();

    const { result } = renderHook(() => useVenueDetailQuery(42, 'u-1'), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useInvalidateVenueDetail', () => {
  it('invalidates every user variant of the venue (prefix match)', async () => {
    const client = newClient();
    client.setQueryData(venueDetailQueryKey(42, 'u-1'), { venue: { id: 42 } });
    client.setQueryData(venueDetailQueryKey(42, 'u-2'), { venue: { id: 42 } });
    client.setQueryData(venueDetailQueryKey(7, 'u-1'), { venue: { id: 7 } });

    const { result } = renderHook(() => useInvalidateVenueDetail(), {
      wrapper: wrapperWith(client),
    });
    result.current(42);

    const state = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
    expect(state(venueDetailQueryKey(42, 'u-1'))).toBe(true);
    expect(state(venueDetailQueryKey(42, 'u-2'))).toBe(true);
    expect(state(venueDetailQueryKey(7, 'u-1'))).toBe(false);
  });
});
