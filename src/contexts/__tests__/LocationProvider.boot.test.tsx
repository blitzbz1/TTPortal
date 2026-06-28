// Stage 1.5 (T033) — boot regression guardrail. Mounts the REAL LocationProvider
// with a full ~10k-row catalog available and asserts the tree commits (paints)
// with selectedCity resolved and activeCities=[] BEFORE the heavy
// toLocationCity/mergeExpansionCityWave build ever runs. Goes RED if a future
// refactor re-introduces a synchronous full-catalog pass on the mount path.
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

const PERSISTED_CITY = {
  id: 42, name: 'București', county: null, country_code: 'RO', country_name: 'Romania',
  admin_area: null, local_area: null, lat: 44.4, lng: 26.1, zoom: 11, venue_count: 5,
  active: true, expansion_status: 'active', updated_at: 't',
};

// A ~10k-row catalog (the cost the mount path must NOT pay synchronously).
const BIG_CATALOG = Array.from({ length: 10000 }, (_, i) => ({
  id: i + 1, name: `City${i + 1}`, county: null, country_code: 'RO', country_name: 'Romania',
  admin_area: null, local_area: null, lat: 44 + i * 1e-4, lng: 26 + i * 1e-4, zoom: 11,
  venue_count: 1, active: true, expansion_status: 'active', updated_at: 't',
}));
BIG_CATALOG[41] = { ...BIG_CATALOG[41], id: 42, name: 'București' }; // ensure the saved id exists

let observed: ReturnType<typeof useSelectedLocation> | null = null;
let painted = false;
function Probe() {
  observed = useSelectedLocation();
  painted = true;
  return null;
}

function fakeHandle() {
  return { cancel: jest.fn() } as unknown as ReturnType<typeof InteractionManager.runAfterInteractions>;
}

beforeEach(() => {
  observed = null;
  painted = false;
  mockUseCitiesQuery.mockReset();
  setString('last_selected_city', JSON.stringify(PERSISTED_CITY));
  setString('last_selected_city_id', '42');
  setString('initial_location_setup_completed', 'true');
});

describe('LocationProvider — boot regression guardrail (T033)', () => {
  it('paints with selectedCity resolved and activeCities=[] before any full-catalog pass', () => {
    mockUseCitiesQuery.mockReturnValue({ data: BIG_CATALOG, isLoading: false, refreshCatalog: jest.fn() });
    const toLocSpy = jest.spyOn(locationHelpers, 'toLocationCity');
    const mergeSpy = jest.spyOn(locationHelpers, 'mergeExpansionCityWave');
    const readSpy = jest.spyOn(citiesCache, 'readCities');
    const cleanSpy = jest.spyOn(cityCatalog, 'cleanCityCatalog');
    let deferred: (() => void) | null = null;
    const iaSpy = jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((cb) => {
      deferred = cb as () => void;
      return fakeHandle();
    });

    render(<LocationProvider><Probe /></LocationProvider>);

    // The tree painted, and the saved city resolved — without touching the catalog.
    expect(painted).toBe(true);
    expect(observed?.selectedCity?.id).toBe(42);
    expect(observed?.activeCities.length).toBe(0);
    // Zero full-catalog passes on the mount-to-first-commit window.
    expect(toLocSpy).not.toHaveBeenCalled();
    expect(mergeSpy).not.toHaveBeenCalled();
    expect(readSpy).not.toHaveBeenCalled();
    expect(cleanSpy).not.toHaveBeenCalled();

    // Once interactions settle, the deferred build runs over the full catalog.
    act(() => { deferred?.(); });
    expect(toLocSpy.mock.calls.length).toBeGreaterThanOrEqual(10000);
    expect(observed?.activeCities.length).toBeGreaterThan(0);

    toLocSpy.mockRestore();
    mergeSpy.mockRestore();
    readSpy.mockRestore();
    cleanSpy.mockRestore();
    iaSpy.mockRestore();
  });
});
