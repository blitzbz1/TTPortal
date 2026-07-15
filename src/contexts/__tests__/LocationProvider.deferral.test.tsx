// Stage 1.5 (T030/T031/T032) — the root LocationProvider must resolve the saved
// city from a persisted 1-row object and defer the full-catalog activeCities
// build off the synchronous mount path. Mounts the REAL provider with
// useCitiesQuery mocked (controllable rows) and the catalog helpers spied.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { LocationProvider } from '../LocationProvider';
import { useSelectedLocation } from '../../hooks/useSelectedLocation';
import { setString } from '../../lib/mmkv';
import * as locationHelpers from '../../lib/locationHelpers';
import * as citiesCache from '../../lib/citiesPersistentCache';
import * as cityCatalog from '../../lib/cityCatalog';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

const mockUseCitiesQuery = jest.fn();
jest.mock('../../hooks/queries/useCitiesQuery', () => ({
  useCitiesQuery: (...args: unknown[]) => mockUseCitiesQuery(...args),
  citiesQueryKey: ['cities', 'delta'],
}));

type Loc = ReturnType<typeof useSelectedLocation>;

// A persisted LocationCity (positive id). Boot must resolve this with ZERO
// catalog access.
const PERSISTED_CITY = {
  id: 42, name: 'București', county: null, country_code: 'RO', country_name: 'Romania',
  admin_area: null, local_area: null, lat: 44.4, lng: 26.1, zoom: 11, venue_count: 5,
  active: true, expansion_status: 'active', updated_at: 't',
};

// Catalog the lazy build runs over (PersistedCity rows, includes the saved id).
const CITY_ROWS = [
  { id: 42, name: 'București', county: null, country_code: 'RO', country_name: 'Romania', admin_area: null, local_area: null, lat: 44.4, lng: 26.1, zoom: 11, venue_count: 9, active: true, expansion_status: 'active', updated_at: 't2' },
  { id: 7, name: 'Cluj', county: null, country_code: 'RO', country_name: 'Romania', admin_area: null, local_area: null, lat: 46.7, lng: 23.6, zoom: 11, venue_count: 3, active: true, expansion_status: 'active', updated_at: 't' },
];

let observed: Loc | null = null;
function Probe() {
  observed = useSelectedLocation();
  return null;
}

function fakeHandle() {
  return { cancel: jest.fn() } as unknown as ReturnType<typeof InteractionManager.runAfterInteractions>;
}

function seedSavedCity() {
  setString('last_selected_city', JSON.stringify(PERSISTED_CITY));
  setString('last_selected_city_id', '42');
  setString('initial_location_setup_completed', 'true');
}

beforeEach(() => {
  observed = null;
  mockUseCitiesQuery.mockReset();
});

describe('LocationProvider — Stage 1.5 deferral', () => {
  it('T030 — resolves selectedCity from the persisted 1-row object with zero catalog parse', () => {
    seedSavedCity();
    mockUseCitiesQuery.mockReturnValue({ data: undefined, isLoading: false, refreshCatalog: jest.fn() });
    const readSpy = jest.spyOn(citiesCache, 'readCities');
    const cleanSpy = jest.spyOn(cityCatalog, 'cleanCityCatalog');
    const iaSpy = jest.spyOn(InteractionManager, 'runAfterInteractions').mockReturnValue(fakeHandle());

    render(<LocationProvider><Probe /></LocationProvider>);

    expect(observed?.selectedCity?.id).toBe(42); // from the persisted object
    expect(observed?.selectedCity?.name).toBe('București');
    expect(readSpy).not.toHaveBeenCalled(); // no 3.35 MB parse on the mount path
    expect(cleanSpy).not.toHaveBeenCalled();

    readSpy.mockRestore();
    cleanSpy.mockRestore();
    iaSpy.mockRestore();
  });

  it('T031 — defers the activeCities build until InteractionManager fires', () => {
    seedSavedCity();
    mockUseCitiesQuery.mockReturnValue({ data: CITY_ROWS, isLoading: false, refreshCatalog: jest.fn() });
    const toLocSpy = jest.spyOn(locationHelpers, 'toLocationCity');
    const mergeSpy = jest.spyOn(locationHelpers, 'mergeExpansionCityWave');
    let deferred: (() => void) | null = null;
    const iaSpy = jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((cb) => {
      deferred = cb as () => void;
      return fakeHandle();
    });

    render(<LocationProvider><Probe /></LocationProvider>);

    // Initial commit: nothing built, selectedCity from the persisted object.
    expect(toLocSpy).not.toHaveBeenCalled();
    expect(mergeSpy).not.toHaveBeenCalled();
    expect(observed?.activeCities.length).toBe(0);
    expect(observed?.selectedCity?.id).toBe(42);

    // Flush the deferred build.
    act(() => { deferred?.(); });
    expect(toLocSpy).toHaveBeenCalled();
    expect(mergeSpy).toHaveBeenCalled();
    expect(observed?.activeCities.length).toBeGreaterThan(0);

    toLocSpy.mockRestore();
    mergeSpy.mockRestore();
    iaSpy.mockRestore();
  });

  it('T031 — requestCatalog() forces the build without waiting for interactions', () => {
    seedSavedCity();
    mockUseCitiesQuery.mockReturnValue({ data: CITY_ROWS, isLoading: false, refreshCatalog: jest.fn() });
    const mergeSpy = jest.spyOn(locationHelpers, 'mergeExpansionCityWave');
    const iaSpy = jest.spyOn(InteractionManager, 'runAfterInteractions').mockReturnValue(fakeHandle());

    render(<LocationProvider><Probe /></LocationProvider>);
    expect(observed?.activeCities.length).toBe(0);

    act(() => { observed?.requestCatalog(); });
    expect(mergeSpy).toHaveBeenCalled();
    expect(observed?.activeCities.length).toBeGreaterThan(0);

    mergeSpy.mockRestore();
    iaSpy.mockRestore();
  });

  it('T032 — locationReady is true at boot with a persisted city, even while the query loads with no rows', () => {
    seedSavedCity();
    mockUseCitiesQuery.mockReturnValue({ data: undefined, isLoading: true, refreshCatalog: jest.fn() });
    const iaSpy = jest.spyOn(InteractionManager, 'runAfterInteractions').mockReturnValue(fakeHandle());

    render(<LocationProvider><Probe /></LocationProvider>);

    expect(observed?.locationReady).toBe(true); // tree-ready before any catalog parse
    expect(observed?.selectedCity?.id).toBe(42);

    iaSpy.mockRestore();
  });
});
