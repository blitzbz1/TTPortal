// T050: real-QueryClient tests for the events hooks — jest.setup's global
// react-query mock runs queryFn eagerly and no-ops the cache, so pagination
// and hydration behavior were untestable. This suite unmocks the library
// and asserts REAL cache state.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useEventsQuery,
  usePastEventsInfiniteQuery,
  eventsQueryKey,
  pastEventsQueryKey,
  isEventsCacheFresh,
} from '../useEventsQuery';

const mockGetEvents = jest.fn();
jest.mock('../../../services/events', () => ({
  getEvents: (...a: any[]) => mockGetEvents(...a),
  PAST_EVENTS_PAGE_SIZE: 20,
}));

const mockGetUserEventFeedbackForEvents = jest.fn();
jest.mock('../../../services/eventFeedback', () => ({
  getUserEventFeedbackForEvents: (...a: any[]) => mockGetUserEventFeedbackForEvents(...a),
}));

jest.mock('../../../services/amatur', () => ({
  getAmaturEvents: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

const mockLoadCachedEvents = jest.fn(() => null as any);
const mockSaveCachedEvents = jest.fn();
const mockLoadCachedFeedbackGiven = jest.fn(() => null as any);
const mockSaveCachedFeedbackGiven = jest.fn();
jest.mock('../../../lib/eventsCache', () => ({
  loadCachedEvents: (...a: any[]) => mockLoadCachedEvents(...(a as [])),
  saveCachedEvents: (...a: any[]) => mockSaveCachedEvents(...(a as [])),
  loadCachedFeedbackGiven: (...a: any[]) => mockLoadCachedFeedbackGiven(...(a as [])),
  saveCachedFeedbackGiven: (...a: any[]) => mockSaveCachedFeedbackGiven(...(a as [])),
}));

const USER = 'u-1';
const CITY = 'București';

const eventRow = (id: number) => ({ id, starts_at: '2026-06-01T10:00:00Z', status: 'open' });

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
  mockLoadCachedEvents.mockReturnValue(null);
  mockLoadCachedFeedbackGiven.mockReturnValue(null);
  mockGetUserEventFeedbackForEvents.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  // Real QueryClients hold subscriptions/timers — clear them so jest exits.
  for (const client of liveClients.splice(0)) {
    client.clear();
    client.unmount();
  }
});

describe('useEventsQuery (real cache)', () => {
  it('fetches into the cache under the documented key and mirrors to disk', async () => {
    const rows = [eventRow(1), eventRow(2)];
    mockGetEvents.mockResolvedValue({ data: rows, error: null });
    const client = newClient();

    const { result } = renderHook(() => useEventsQuery('upcoming', USER, CITY), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.data).toEqual(rows));
    expect(mockGetEvents).toHaveBeenCalledWith('upcoming', USER, { limit: 50, offset: 0, city: CITY });
    expect(client.getQueryData(eventsQueryKey('upcoming', USER, CITY))).toEqual(rows);
    expect(mockSaveCachedEvents).toHaveBeenCalledWith(USER, 'upcoming', rows, CITY);
  });

  it('hydrates initialData from a fresh disk cache without refetching', async () => {
    const cached = [eventRow(7)];
    mockLoadCachedEvents.mockReturnValue({ data: cached, fresh: true });
    const client = newClient();

    const { result } = renderHook(() => useEventsQuery('upcoming', USER, CITY), {
      wrapper: wrapperWith(client),
    });

    expect(result.current.data).toEqual(cached);
    // Fresh disk data counts as just-fetched — no network within staleTime.
    await act(async () => {});
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  it('hydrates a stale disk cache but refetches in the background', async () => {
    const cached = [eventRow(7)];
    const fresh = [eventRow(7), eventRow(8)];
    mockLoadCachedEvents.mockReturnValue({ data: cached, fresh: false });
    mockGetEvents.mockResolvedValue({ data: fresh, error: null });
    const client = newClient();

    const { result } = renderHook(() => useEventsQuery('upcoming', USER, CITY), {
      wrapper: wrapperWith(client),
    });

    expect(result.current.data).toEqual(cached);
    await waitFor(() => expect(result.current.data).toEqual(fresh));
  });

  it('keeps hydrated data and flags isError when the refetch fails (offline banner, T035)', async () => {
    const cached = [eventRow(7)];
    mockLoadCachedEvents.mockReturnValue({ data: cached, fresh: false });
    mockGetEvents.mockResolvedValue({ data: null, error: { message: 'network' } });
    const client = newClient();

    const { result } = renderHook(() => useEventsQuery('upcoming', USER, CITY), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual(cached);
  });
});

describe('usePastEventsInfiniteQuery (real cache)', () => {
  it('pages by offset and carries feedback ids per page', async () => {
    const pageOne = Array.from({ length: 20 }, (_, i) => eventRow(i + 1));
    const pageTwo = [eventRow(21)];
    mockGetEvents
      .mockResolvedValueOnce({ data: pageOne, error: null })
      .mockResolvedValueOnce({ data: pageTwo, error: null });
    mockGetUserEventFeedbackForEvents
      .mockResolvedValueOnce({ data: [3], error: null })
      .mockResolvedValueOnce({ data: [21], error: null });
    const client = newClient();

    const { result } = renderHook(() => usePastEventsInfiniteQuery(USER, CITY), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(mockGetEvents).toHaveBeenCalledWith('past', USER, { limit: 20, offset: 0, city: CITY });
    expect(result.current.hasNextPage).toBe(true);
    // Page one mirrors to the disk cache; later pages don't.
    expect(mockSaveCachedEvents).toHaveBeenCalledWith(USER, 'past', pageOne, CITY);
    expect(mockSaveCachedFeedbackGiven).toHaveBeenCalledWith(USER, [3]);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(mockGetEvents).toHaveBeenCalledWith('past', USER, { limit: 20, offset: 20, city: CITY });
    expect(result.current.data?.pages[1]).toEqual({ events: pageTwo, feedbackGivenIds: [21] });
    // Short page → no further pages.
    expect(result.current.hasNextPage).toBe(false);
    expect(mockSaveCachedEvents).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(pastEventsQueryKey(USER, CITY))).toEqual(result.current.data);
  });

  it('hydrates page one (events + feedback ids) from the disk cache', async () => {
    const cached = [eventRow(5)];
    mockLoadCachedEvents.mockReturnValue({ data: cached, fresh: true });
    mockLoadCachedFeedbackGiven.mockReturnValue([5]);
    const client = newClient();

    const { result } = renderHook(() => usePastEventsInfiniteQuery(USER, CITY), {
      wrapper: wrapperWith(client),
    });

    expect(result.current.data?.pages[0]).toEqual({ events: cached, feedbackGivenIds: [5] });
    await act(async () => {});
    expect(mockGetEvents).not.toHaveBeenCalled();
  });
});

describe('isEventsCacheFresh', () => {
  it('reflects disk-cache freshness and is false without a user', () => {
    mockLoadCachedEvents.mockReturnValue({ data: [], fresh: true });
    expect(isEventsCacheFresh(USER, 'upcoming', CITY)).toBe(true);
    expect(isEventsCacheFresh(undefined, 'upcoming', CITY)).toBe(false);
    mockLoadCachedEvents.mockReturnValue({ data: [], fresh: false });
    expect(isEventsCacheFresh(USER, 'upcoming', CITY)).toBe(false);
    mockLoadCachedEvents.mockReturnValue(null);
    expect(isEventsCacheFresh(USER, 'upcoming', CITY)).toBe(false);
  });
});
