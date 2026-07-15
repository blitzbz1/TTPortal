/**
 * T041 regression: typing in the map search box must not reconcile the
 * marker layer. Markers are chip-filtered only (search narrows the list,
 * not the map) and VenueMarkers is memoized, so keystrokes change none of
 * its props.
 */
const mockMarkerRenders = { count: 0 };
const mockEmptyVenueIds = new Set<number>();

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return <View {...props} />;
  });
  MockMapView.displayName = 'MockMapView';
  const MockMarker = (props: any) => {
    mockMarkerRenders.count++;
    return <View {...props} />;
  };
  const MockCallout = (props: any) => <View {...props} />;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Callout: MockCallout,
  };
});

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
    lang: 'en' as const,
    setLang: jest.fn(),
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));
jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0, refreshUnreadCount: jest.fn(), clearAll: jest.fn(), pushToken: null }),
}));
// This regression measures search-state isolation only. Keep the independent
// marker overlays stable so a background query settling during the debounce
// window cannot be misreported as a search-triggered marker render.
jest.mock('../../hooks/queries/useFriendPresenceQuery', () => ({
  useFriendPresenceQuery: () => ({ data: undefined }),
}));
jest.mock('../../features/venueIntel', () => ({
  useLiveVenueCountsQuery: () => ({ data: undefined }),
  useCityVenueAmenitiesQuery: () => ({ data: undefined }),
}));
jest.mock('../../features/coaches', () => ({
  useCoachingVenueIdsQuery: () => ({ data: undefined }),
}));
jest.mock('../../features/openplay', () => ({
  useOpenPlayCountsQuery: () => ({ data: undefined }),
}));
jest.mock('../../features/explorer', () => ({
  useUnvisitedVenuesQuery: () => ({ unvisitedVenueIds: mockEmptyVenueIds }),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../../components/CityPickerModal', () => ({
  CityPickerModal: () => null,
}));

// Spread venues far enough apart that none cluster at city zoom — every
// venue renders as an individual Marker.
const mockVenues = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Venue ${i + 1}`,
  type: i % 2 === 0 ? 'parc_exterior' : 'sala_indoor',
  city: 'București',
  city_id: 1,
  address: `Street ${i + 1}`,
  lat: 44.3 + (i % 4) * 0.08,
  lng: 26.0 + Math.floor(i / 4) * 0.08,
  tables_count: 2,
  condition: 'buna',
  free_access: true,
  night_lighting: false,
  nets: true,
  verified: false,
  approved: true,
  updated_at: 't',
  created_at: 't',
}));

jest.mock('../../services/venuesDelta', () => ({
  getVenuesDelta: jest.fn(() =>
    Promise.resolve({
      data: { upserts: mockVenues, tombstone_ids: [], synced_at: '2026-06-10T00:00:00Z' },
      error: null,
    }),
  ),
}));

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { clearVenuesCache } from '../../lib/venuesPersistentCache';
import { MapViewScreen } from '../../screens/MapViewScreen';

describe('MapViewScreen marker render hygiene (T041)', () => {
  beforeEach(() => {
    clearVenuesCache();
    mockMarkerRenders.count = 0;
  });

  it('does not re-render markers on search keystrokes', async () => {
    const { getByPlaceholderText, getByTestId } = render(<MapViewScreen hideTabBar />);

    await waitFor(() => expect(getByTestId('venues-count')).toBeTruthy());
    await waitFor(() => expect(mockMarkerRenders.count).toBeGreaterThan(0));

    const baseline = mockMarkerRenders.count;
    const input = getByPlaceholderText('Search venues...');

    await act(async () => {
      fireEvent.changeText(input, 'V');
      fireEvent.changeText(input, 'Ve');
      fireEvent.changeText(input, 'Ven');
      fireEvent.changeText(input, 'Venue 3');
      // Let the 150ms debounce settle and the list re-filter.
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(mockMarkerRenders.count).toBe(baseline);
  });

  it('renders the venue set as markers (clusters and/or pins)', async () => {
    // Exact cluster-vs-pin behavior per zoom level is covered in
    // src/components/__tests__/VenueMarkers.test.tsx; here we only assert
    // the layer renders at the screen's default region. (mockVenues feeds
    // the delta mock above.)
    expect(mockVenues.length).toBeGreaterThan(0);
    const { getByTestId } = render(<MapViewScreen hideTabBar />);
    await waitFor(() => expect(mockMarkerRenders.count).toBeGreaterThan(0));
    expect(getByTestId('venues-count')).toBeTruthy();
  });
});
