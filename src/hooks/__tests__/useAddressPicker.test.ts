import { renderHook, act } from '@testing-library/react-native';
import { useAddressPicker, type KnownCityRecord, type UseAddressPickerOptions } from '../useAddressPicker';

// The hook talks to Nominatim directly via fetch; route responses by URL so
// search, reverse-geocode and city-center lookups can be asserted separately.
const fetchMock = jest.fn();
(global as { fetch: unknown }).fetch = fetchMock;

function jsonResponse(payload: unknown) {
  return { ok: true, json: async () => payload };
}

const CLUJ_RECORD: KnownCityRecord = {
  name: 'Cluj-Napoca',
  country_code: 'RO',
  country_name: 'Romania',
  lat: 46.7712,
  lng: 23.6236,
  zoom: 13,
};

const STREET_SUGGESTION = {
  display_name: 'Strada Exemplu, Cluj-Napoca, Cluj, Romania',
  lat: '46.7700',
  lon: '23.6200',
  address: {
    road: 'Strada Exemplu',
    house_number: '12',
    city: 'Cluj-Napoca',
    country: 'Romania',
    country_code: 'ro',
  },
};

const REVERSE_RESULT = {
  display_name: 'Strada Inversa 4, Cluj-Napoca, Cluj, Romania',
  address: {
    road: 'Strada Inversa',
    house_number: '4',
    city: 'Cluj-Napoca',
    country: 'Romania',
    country_code: 'ro',
  },
};

const VIENNA_CENTER = {
  display_name: 'Wien, Österreich',
  lat: '48.2082',
  lon: '16.3738',
  address: { city: 'Wien', country: 'Austria', country_code: 'at' },
};

function routeFetch({
  search = [STREET_SUGGESTION],
  reverse = REVERSE_RESULT,
  cityCenter = [VIENNA_CENTER],
}: { search?: unknown[]; reverse?: unknown; cityCenter?: unknown[] } = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/reverse')) return jsonResponse(reverse);
    // fetchCityCenter builds its URL by hand with `limit=1&dedupe=1`;
    // search URLs (URLSearchParams) serialize as `...&limit=5` instead.
    if (url.includes('limit=1&dedupe=1')) return jsonResponse(cityCenter);
    return jsonResponse(search);
  });
}

function setup(overrides: Partial<UseAddressPickerOptions> = {}) {
  const onChange = jest.fn();
  const options: UseAddressPickerOptions = {
    address: '',
    city: 'Cluj-Napoca',
    knownCities: ['Cluj-Napoca', 'București'],
    knownCityRecords: [CLUJ_RECORD],
    countryCode: 'RO',
    countryName: 'Romania',
    cityCenterLat: 46.7712,
    cityCenterLng: 23.6236,
    cityZoom: 13,
    onChange,
    ...overrides,
  };
  const view = renderHook(() => useAddressPicker(options));
  return { ...view, onChange };
}

async function flushDebounce(ms = 800) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  // Let the fetch promises started by the debounce callback settle.
  await act(async () => {});
}

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset();
  routeFetch();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAddressPicker — typeahead search', () => {
  it('debounces input and surfaces ranked Nominatim suggestions', async () => {
    const { result, onChange } = setup();

    act(() => result.current.handleAddressChange('Strada Exemplu'));
    expect(onChange).toHaveBeenCalledWith({ address: 'Strada Exemplu' });
    expect(result.current.searching).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); // still inside the debounce window

    await flushDebounce();

    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([url]) => (url as string).includes('nominatim.openstreetmap.org/search'))).toBe(true);
    expect(result.current.searching).toBe(false);
    expect(result.current.showSuggestions).toBe(true);
    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].display_name).toBe(STREET_SUGGESTION.display_name);
  });

  it('does not search for queries shorter than 3 characters', async () => {
    const { result } = setup();

    act(() => result.current.handleAddressChange('St'));
    expect(result.current.searching).toBe(false);

    await flushDebounce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.showSuggestions).toBe(false);
  });

  it('skips re-fetching when the trimmed query matches the last one', async () => {
    const { result } = setup({ address: 'Strada Exemplu' });

    act(() => result.current.handleAddressChange('Strada Exemplu '));
    await flushDebounce();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);
  });
});

describe('useAddressPicker — suggestion selection and city matching', () => {
  it('patches address + coords, animates the map and matches a known city record', async () => {
    const { result, onChange } = setup();
    const animateToRegion = jest.fn();
    result.current.mapRef.current = { animateToRegion };

    await act(async () => {
      result.current.handleSuggestionSelect(STREET_SUGGESTION);
    });

    expect(onChange).toHaveBeenCalledWith({
      address: 'Strada Exemplu 12, Cluj-Napoca',
      lat: 46.77,
      lng: 23.62,
    });
    expect(animateToRegion).toHaveBeenCalledWith(
      { latitude: 46.77, longitude: 23.62, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500,
    );
    // Known-city record supplies canonical city + country + city center …
    expect(onChange).toHaveBeenCalledWith({
      city: 'Cluj-Napoca',
      countryCode: 'RO',
      countryName: 'Romania',
      cityCenterLat: CLUJ_RECORD.lat,
      cityCenterLng: CLUJ_RECORD.lng,
      cityZoom: CLUJ_RECORD.zoom,
    });
    // … so no network city-center lookup is needed.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.showSuggestions).toBe(false);
    expect(result.current.suggestions).toHaveLength(0);
  });

  it('falls back to a Nominatim city-center lookup for unknown cities', async () => {
    const { result, onChange } = setup({ knownCityRecords: [], knownCities: [] });
    const viennaSuggestion = {
      display_name: 'Ringstraße, Wien, Österreich',
      lat: '48.2082',
      lon: '16.3738',
      address: { road: 'Ringstraße', city: 'Wien', country: 'Austria', country_code: 'at' },
    };

    await act(async () => {
      result.current.handleSuggestionSelect(viennaSuggestion);
    });

    // City flows through as-is with a null center first …
    expect(onChange).toHaveBeenCalledWith({
      city: 'Wien',
      countryCode: 'AT',
      countryName: 'Austria',
      cityCenterLat: null,
      cityCenterLng: null,
      cityZoom: 12,
    });
    // … then the async lookup patches the resolved center.
    const cityCenterCall = fetchMock.mock.calls.find(([url]) => (url as string).includes('limit=1&dedupe=1'));
    expect(cityCenterCall?.[0]).toContain('countrycodes=at');
    expect(onChange).toHaveBeenCalledWith({
      cityCenterLat: 48.2082,
      cityCenterLng: 16.3738,
      cityZoom: 12,
      countryCode: 'AT',
      countryName: 'Austria',
    });
  });
});

describe('useAddressPicker — explicit geocode', () => {
  it('geocodes the typed address and normalizes it from the top result', async () => {
    const { result, onChange } = setup({ address: 'Strada Exemplu 12' });
    const animateToRegion = jest.fn();
    result.current.mapRef.current = { animateToRegion };

    await act(async () => {
      await result.current.handleGeocode();
    });

    expect(onChange).toHaveBeenCalledWith({
      lat: 46.77,
      lng: 23.62,
      address: 'Strada Exemplu 12, Cluj-Napoca',
    });
    expect(animateToRegion).toHaveBeenCalled();
    expect(result.current.geocoding).toBe(false);
  });

  it('does nothing for a blank address', async () => {
    const { result, onChange } = setup({ address: '   ' });

    await act(async () => {
      await result.current.handleGeocode();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('useAddressPicker — reverse geocoding on pin moves', () => {
  const dragEvent = { nativeEvent: { coordinate: { latitude: 46.75, longitude: 23.61 } } };

  it('marker drag patches coords immediately, then the reverse-geocoded address', async () => {
    const { result, onChange } = setup();

    await act(async () => {
      result.current.handleMarkerDragEnd(dragEvent);
    });

    expect(onChange).toHaveBeenNthCalledWith(1, { lat: 46.75, lng: 23.61 });
    const reverseCall = fetchMock.mock.calls.find(([url]) => (url as string).includes('/reverse'));
    expect(reverseCall?.[0]).toContain('lat=46.75');
    expect(reverseCall?.[0]).toContain('lon=23.61');
    expect(onChange).toHaveBeenCalledWith({ address: 'Strada Inversa 4, Cluj-Napoca' });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ city: 'Cluj-Napoca' }));
    expect(result.current.reverseGeocoding).toBe(false);
  });

  it('map tap re-centers the camera and reverse geocodes the tapped point', async () => {
    const { result, onChange } = setup();
    const animateToRegion = jest.fn();
    result.current.mapRef.current = { animateToRegion };

    await act(async () => {
      result.current.handleMapPress(dragEvent);
    });

    expect(animateToRegion).toHaveBeenCalledWith(
      { latitude: 46.75, longitude: 23.61, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      300,
    );
    expect(onChange).toHaveBeenCalledWith({ lat: 46.75, lng: 23.61 });
    expect(fetchMock.mock.calls.some(([url]) => (url as string).includes('/reverse'))).toBe(true);
  });

  it('keeps the coords but skips the address patch when reverse geocoding fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    const { result, onChange } = setup();

    await act(async () => {
      result.current.handleMarkerDragEnd(dragEvent);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ lat: 46.75, lng: 23.61 });
    expect(result.current.reverseGeocoding).toBe(false);
  });

  it('ignores events without a coordinate', async () => {
    const { result, onChange } = setup();

    await act(async () => {
      result.current.handleMarkerDragEnd({});
      result.current.handleMapPress({ nativeEvent: {} });
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
