// Stage 3 (T073) — the bottom-sheet list renders the slim venue row: the city
// badge is sourced from selectedCity.name (the row no longer carries `city`), and
// address search still filters.
const mockVenues = [
  // NO `city` field — the slim get_venues_map_delta shape.
  { id: 1, name: 'Park Alpha', type: 'parc_exterior', address: 'Friedrichstrasse 1', lat: 52.5, lng: 13.4, tables_count: 2, condition: 'buna', free_access: true, night_lighting: false, nets: true, verified: false, venue_stats: null },
  { id: 2, name: 'Hall Beta', type: 'sala_indoor', address: 'Alexanderplatz 9', lat: 52.52, lng: 13.41, tables_count: 4, condition: 'profesionala', free_access: false, night_lighting: true, nets: true, verified: true, venue_stats: null },
];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ session: null, user: null, isLoading: false }),
}));
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => require('../../locales/en.json')[key] || key,
    sn: (key: string, count: number) => `${count} ${require('../../locales/en.json')[key] || key}`,
    lang: 'en' as const, setLang: jest.fn(),
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light', resolved: 'light', isDark: false, setMode: jest.fn(),
  }),
}));
jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0, refreshUnreadCount: jest.fn(), clearAll: jest.fn(), pushToken: null }),
}));
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef(function MapViewMock(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn(), animateCamera: jest.fn() }));
    return React.createElement(View, props);
  });
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React.createElement(View, props),
    Callout: (props: any) => React.createElement(View, props),
  };
});
// Deny location so distanceKm stays null → the city badge path renders.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../../hooks/queries/useVenuesQuery', () => ({
  useVenuesQuery: () => ({ data: mockVenues, isLoading: false, isError: false, refetch: jest.fn(), fromCache: false }),
  invalidateVenues: () => jest.fn(),
}));
jest.mock('../../hooks/useSelectedLocation', () => ({
  useSelectedLocation: () => ({
    selectedCountry: { code: 'DE', name: 'Germany', active: true },
    selectedCity: { id: 5, name: 'Berlin', country_code: 'DE', country_name: 'Germany', admin_area: null, local_area: null, county: null, lat: 52.52, lng: 13.4, zoom: 11, venue_count: 2, active: true, expansion_status: 'active', updated_at: 't' },
    activeCountries: [{ code: 'DE', name: 'Germany', active: true }],
    activeCities: [],
    citiesForSelectedCountry: [],
    loadingCities: false,
    locationReady: true,
    hasCompletedInitialLocationSetup: true,
    requestCatalog: jest.fn(),
    refreshCities: jest.fn(async () => {}),
    setSelectedCountry: jest.fn(),
    setSelectedCity: jest.fn(),
    completeInitialLocationSetup: jest.fn(),
    resetInitialLocationSetup: jest.fn(),
  }),
}));
jest.mock('../../components/CityPickerModal', () => ({ CityPickerModal: () => null }));

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { MapViewScreen } from '../MapViewScreen';

describe('MapViewScreen — slim venue list (Stage 3)', () => {
  it('renders the venue and shows the city badge from selectedCity.name (not v.city)', async () => {
    const { getByText, getAllByText } = render(<MapViewScreen hideTabBar />);
    await waitFor(() => expect(getByText('Park Alpha')).toBeTruthy());
    // Both distance-less rows show the city badge sourced from selectedCity.name,
    // even though the slim rows carry no `city` field.
    expect(getAllByText('Berlin').length).toBeGreaterThanOrEqual(2);
  });

  it('filters the list by an address substring (address-search survives the slim row)', async () => {
    const { getByPlaceholderText, getByText, getAllByText } = render(<MapViewScreen hideTabBar />);
    // Both distance-less rows render a 'Berlin' city badge initially.
    await waitFor(() => expect(getAllByText('Berlin').length).toBe(2));

    // 'Alexanderplatz' matches only Hall Beta's address → the list narrows to it.
    fireEvent.changeText(getByPlaceholderText('Search venues...'), 'Alexanderplatz');
    await waitFor(() => expect(getAllByText('Berlin').length).toBe(1)); // Park Alpha filtered out
    expect(getByText('Hall Beta')).toBeTruthy(); // the address match survived
  });
});
