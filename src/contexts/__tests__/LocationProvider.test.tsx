// Stage 2 (T051) — the single-row fallback for a saved selectedCity whose id is
// no longer in the eager tier. Boot must resolve it from ONE row (the persisted
// boot object, a getCitiesByIds fetch, or the EXPANSION_CITY_WAVE) — never a full
// catalog re-pull, never a default-city flash for the persisted case.
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { LocationProvider } from '../LocationProvider';
import { useSelectedLocation } from '../../hooks/useSelectedLocation';
import { setString, removeString, getStringSync } from '../../lib/mmkv';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

const mockUseCitiesQuery = jest.fn();
jest.mock('../../hooks/queries/useCitiesQuery', () => ({
  useCitiesQuery: (...args: unknown[]) => mockUseCitiesQuery(...args),
  citiesQueryKey: ['cities', 'delta'],
}));

const mockGetCitiesByIds = jest.fn();
jest.mock('../../services/citiesDelta', () => ({
  getCitiesByIds: (...args: unknown[]) => mockGetCitiesByIds(...args),
}));

type Loc = ReturnType<typeof useSelectedLocation>;

// The eager tier (does NOT contain the out-of-tier saved ids 777 / 888).
const TIER_ROWS = [
  { id: 7, name: 'Cluj', county: null, country_code: 'RO', country_name: 'Romania', admin_area: null, local_area: null, lat: 46.7, lng: 23.6, zoom: 11, venue_count: 3, active: true, expansion_status: 'active', updated_at: 't', search_key: 'cluj' },
];

let observed: Loc | null = null;
function Probe() {
  observed = useSelectedLocation();
  return null;
}
function fakeHandle() {
  return { cancel: jest.fn() } as unknown as ReturnType<typeof InteractionManager.runAfterInteractions>;
}

const CITY_KEYS = ['last_selected_city', 'last_selected_city_id', 'initial_location_setup_completed', 'last_selected_country_code'];

beforeEach(() => {
  observed = null;
  mockUseCitiesQuery.mockReset();
  mockUseCitiesQuery.mockReturnValue({ data: TIER_ROWS, isLoading: false, refreshCatalog: jest.fn() });
  mockGetCitiesByIds.mockReset();
  mockGetCitiesByIds.mockResolvedValue({ data: [], error: null });
  CITY_KEYS.forEach(removeString);
  // Build the catalog eagerly (flush the deferred InteractionManager build) so
  // the post-build resolution path is exercised synchronously.
  jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((cb: any) => {
    cb();
    return fakeHandle();
  });
});
afterEach(() => jest.restoreAllMocks());

describe('LocationProvider — Stage 2 out-of-tier fallback (T051)', () => {
  it('resolves a persisted out-of-tier city from the boot object — no fetch, no default flash', async () => {
    const buftea = { id: 777, name: 'Buftea', county: null, country_code: 'RO', country_name: 'Romania', admin_area: 'Ilfov', local_area: null, lat: 44.6, lng: 25.9, zoom: 12, venue_count: 0, active: true, expansion_status: 'active', updated_at: 't' };
    setString('last_selected_city', JSON.stringify(buftea));
    setString('last_selected_city_id', '777');
    setString('initial_location_setup_completed', 'true');

    render(<LocationProvider><Probe /></LocationProvider>);
    await act(async () => {}); // let any effects settle

    expect(observed?.selectedCity?.id).toBe(777); // the saved city, not Cluj/default
    expect(observed?.selectedCity?.name).toBe('Buftea');
    expect(mockGetCitiesByIds).not.toHaveBeenCalled(); // boot object covered it — zero network
  });

  it('fetches a saved positive out-of-tier id by single row (id-only upgrade path)', async () => {
    // Only the id is persisted (upgrade from the pre-Stage-1.5 id-only format),
    // so the boot object can't cover it → exactly one getCitiesByIds([888]).
    const sibiu = { id: 888, name: 'Sibiu', county: null, country_code: 'RO', country_name: 'Romania', admin_area: 'Sibiu', local_area: null, lat: 45.8, lng: 24.1, zoom: 12, venue_count: 0, active: true, expansion_status: 'active', updated_at: 't', search_key: 'sibiu' };
    mockGetCitiesByIds.mockResolvedValue({ data: [sibiu], error: null });
    setString('last_selected_city_id', '888');
    setString('initial_location_setup_completed', 'true');

    render(<LocationProvider><Probe /></LocationProvider>);

    await waitFor(() => expect(observed?.selectedCity?.id).toBe(888));
    expect(observed?.selectedCity?.name).toBe('Sibiu');
    expect(mockGetCitiesByIds).toHaveBeenCalledWith([888]); // single row, not a full re-sync
  });

  it('does NOT clobber the saved city when the single-row fetch errors transiently', async () => {
    // Fix #1: getCitiesByIds returns {data:[], error} on a network/RPC blip (it
    // never throws). The provider must treat that as "still pending", NOT "city
    // gone" — otherwise the persist effects would overwrite CITY_KEY/CITY_OBJ_KEY
    // with a default and the saved city would be lost permanently.
    mockGetCitiesByIds.mockResolvedValue({ data: [], error: { message: 'network blip' } });
    setString('last_selected_city_id', '888');
    setString('initial_location_setup_completed', 'true');

    render(<LocationProvider><Probe /></LocationProvider>);
    await act(async () => {});

    expect(mockGetCitiesByIds).toHaveBeenCalledWith([888]);
    // selectedCity held pending (null) — NOT collapsed to a default city...
    expect(observed?.selectedCity).toBeNull();
    // ...and the saved id is preserved in MMKV (not clobbered to a default).
    expect(getStringSync('last_selected_city_id')).toBe('888');
  });

  it('falls to the default city when get_cities_by_ids is not deployed (PGRST202)', async () => {
    // Prod scenario: migration 139 (get_cities_by_ids) isn't deployed, so a saved
    // out-of-tier positive id 404s. A MISSING RPC is permanent → resolve to the
    // default city (Cluj here) rather than hanging on a null selectedCity.
    mockGetCitiesByIds.mockResolvedValue({ data: [], error: { code: 'PGRST202', message: 'Could not find the function' } });
    setString('last_selected_city_id', '888'); // not in TIER_ROWS
    setString('initial_location_setup_completed', 'true');

    render(<LocationProvider><Probe /></LocationProvider>);
    await waitFor(() => expect(observed?.selectedCity?.id).toBe(7)); // default (Cluj), not null
    expect(observed?.selectedCity?.name).toBe('Cluj');
  });

  it('resolves a saved negative wave id to the EXPANSION_CITY_WAVE entry without any fetch', async () => {
    setString('last_selected_city_id', '-1002'); // Berlin wave city
    setString('initial_location_setup_completed', 'true');

    render(<LocationProvider><Probe /></LocationProvider>);
    await act(async () => {});

    expect(observed?.selectedCity?.id).toBe(-1002);
    expect(observed?.selectedCity?.name).toBe('Berlin');
    expect(mockGetCitiesByIds).not.toHaveBeenCalled(); // negative ids are client-only
  });
});
