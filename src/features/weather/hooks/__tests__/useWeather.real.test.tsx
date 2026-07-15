// Real-QueryClient tests for the weather hook: jest.setup's global react-query
// mock runs queryFn eagerly and no-ops the cache, so initialData hydration is
// untestable under it. Unmock and assert real stale-while-revalidate behavior.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWeatherQuery, weatherQueryKey } from '../useWeather';

const mockGetWeather = jest.fn();
jest.mock('../../../../services/weather', () => ({
  getWeather: (...a: any[]) => mockGetWeather(...a),
}));

const mockLoad = jest.fn((..._a: any[]) => null as any);
const mockSave = jest.fn();
jest.mock('../../../../lib/weatherCache', () => ({
  loadCachedWeather: (...a: any[]) => mockLoad(...a),
  saveCachedWeather: (...a: any[]) => mockSave(...a),
}));

const LAT = 44.43;
const LNG = 26.1;
const SUMMARY = { temp_c: 20, wind_kmh: 5, weather_code: 0, raining_now: false, rain_at: null, fetched_at: 't' };

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

describe('useWeatherQuery (real cache)', () => {
  it('fetches under the rounded key and mirrors the summary to disk', async () => {
    mockGetWeather.mockResolvedValue({ data: SUMMARY, error: null });
    const client = newClient();

    const { result } = renderHook(() => useWeatherQuery(LAT, LNG, true), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.data).toEqual(SUMMARY));
    expect(mockGetWeather).toHaveBeenCalledWith(LAT, LNG);
    expect(mockSave).toHaveBeenCalledWith(LAT, LNG, SUMMARY);
    expect(client.getQueryData(weatherQueryKey(LAT, LNG))).toEqual(SUMMARY);
  });

  it('hydrates a fresh disk cell without hitting the network', async () => {
    mockLoad.mockReturnValue({ data: SUMMARY, fresh: true });
    const client = newClient();

    const { result } = renderHook(() => useWeatherQuery(LAT, LNG, true), { wrapper: wrapperWith(client) });

    expect(result.current.data).toEqual(SUMMARY);
    await act(async () => {});
    expect(mockGetWeather).not.toHaveBeenCalled();
  });

  it('hydrates a stale disk cell but refetches in the background', async () => {
    const fresh = { ...SUMMARY, temp_c: 25 };
    mockLoad.mockReturnValue({ data: SUMMARY, fresh: false });
    mockGetWeather.mockResolvedValue({ data: fresh, error: null });
    const client = newClient();

    const { result } = renderHook(() => useWeatherQuery(LAT, LNG, true), { wrapper: wrapperWith(client) });

    expect(result.current.data).toEqual(SUMMARY);
    await waitFor(() => expect(result.current.data).toEqual(fresh));
  });

  it('never caches a null (error) payload', async () => {
    mockGetWeather.mockResolvedValue({ data: null, error: 'HTTP 500' });
    const client = newClient();

    renderHook(() => useWeatherQuery(LAT, LNG, true), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(mockGetWeather).toHaveBeenCalled());
    expect(mockSave).not.toHaveBeenCalled();
  });
});
