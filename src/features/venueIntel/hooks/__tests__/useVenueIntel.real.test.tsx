// Real-QueryClient tests for the venue-intel hook (busyness bundle): asserts
// the persistent stale-while-revalidate wiring. jest.setup's global react-query
// mock no-ops initialData, so unmock for real behavior.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVenueIntelQuery, venueIntelQueryKey } from '../useVenueIntel';

const mockBusyness = jest.fn();
const mockFree = jest.fn();
const mockAmenities = jest.fn();
const mockRegulars = jest.fn();
jest.mock('../../../../services/venueIntel', () => ({
  getVenueBusyness: (...a: any[]) => mockBusyness(...a),
  getVenueFreeTables: (...a: any[]) => mockFree(...a),
  getVenueAmenities: (...a: any[]) => mockAmenities(...a),
  getVenueRegulars: (...a: any[]) => mockRegulars(...a),
}));

const mockLoad = jest.fn((..._a: any[]) => null as any);
const mockSave = jest.fn();
jest.mock('../../../../lib/venueIntelCache', () => ({
  loadCachedVenueIntel: (...a: any[]) => mockLoad(...a),
  saveCachedVenueIntel: (...a: any[]) => mockSave(...a),
}));

const VENUE = 42;
const BUNDLE = {
  busyness: { live_count: 5, sample_size: 0, histogram: null },
  freeTables: null,
  amenities: null,
  regulars: null,
};

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const liveClients: QueryClient[] = [];
function newClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  liveClients.push(client);
  return client;
}

function allResolve() {
  mockBusyness.mockResolvedValue({ data: BUNDLE.busyness, error: null });
  mockFree.mockResolvedValue({ data: null, error: null });
  mockAmenities.mockResolvedValue({ data: null, error: null });
  mockRegulars.mockResolvedValue({ data: null, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoad.mockReturnValue(null);
});

afterEach(() => {
  for (const client of liveClients.splice(0)) {
    client.clear();
    client.unmount();
  }
});

describe('useVenueIntelQuery (real cache)', () => {
  it('builds the bundle from all four sources and mirrors it to disk per venue', async () => {
    allResolve();
    const client = newClient();

    const { result } = renderHook(() => useVenueIntelQuery(VENUE), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.data?.busyness).toEqual(BUNDLE.busyness));
    expect(mockBusyness).toHaveBeenCalledWith(VENUE);
    expect(mockSave).toHaveBeenCalledWith(VENUE, BUNDLE);
    expect(client.getQueryData(venueIntelQueryKey(VENUE))).toEqual(BUNDLE);
  });

  it('hydrates a fresh disk bundle without hitting the network', async () => {
    allResolve();
    mockLoad.mockReturnValue({ data: BUNDLE, fresh: true });
    const client = newClient();

    const { result } = renderHook(() => useVenueIntelQuery(VENUE), { wrapper: wrapperWith(client) });

    expect(result.current.data).toEqual(BUNDLE);
    await act(async () => {});
    expect(mockBusyness).not.toHaveBeenCalled();
  });

  it('hydrates a stale disk bundle but refetches in the background', async () => {
    const fresh = { ...BUNDLE, busyness: { live_count: 9, sample_size: 0, histogram: null } };
    mockLoad.mockReturnValue({ data: BUNDLE, fresh: false });
    mockBusyness.mockResolvedValue({ data: fresh.busyness, error: null });
    mockFree.mockResolvedValue({ data: null, error: null });
    mockAmenities.mockResolvedValue({ data: null, error: null });
    mockRegulars.mockResolvedValue({ data: null, error: null });
    const client = newClient();

    const { result } = renderHook(() => useVenueIntelQuery(VENUE), { wrapper: wrapperWith(client) });

    expect(result.current.data).toEqual(BUNDLE);
    await waitFor(() => expect(result.current.data?.busyness).toEqual(fresh.busyness));
  });
});
