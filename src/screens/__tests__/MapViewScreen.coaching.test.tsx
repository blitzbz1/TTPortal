// F063: the map "Coaching" filter chip keeps only venues with an approved coach.
const VENUE_ROWS = [
  { id: 1, name: 'Park A', type: 'parc_exterior', city: 'București', lat: 44.4, lng: 26.1, condition: 'buna', venue_stats: null, tables_count: 2, verified: false },
  { id: 2, name: 'Hall B', type: 'sala_indoor', city: 'București', lat: 44.5, lng: 26.2, condition: 'buna', venue_stats: null, tables_count: 4, verified: true },
];
const mockGetVenuesDelta = jest.fn().mockResolvedValue({
  data: { upserts: VENUE_ROWS, tombstone_ids: [], synced_at: '2026-06-16T00:00:00Z' },
  error: null,
});

const mockGetCoachingVenueIds = jest.fn();
jest.mock('../../services/coaches', () => ({
  getCoachingVenueIds: (...args: any[]) => mockGetCoachingVenueIds(...args),
}));

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
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Marker: (props: any) => <View {...props} />,
    Callout: (props: any) => <View {...props} />,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../../services/venues', () => ({ getVenues: jest.fn() }));
jest.mock('../../services/venuesDelta', () => ({
  getVenuesDelta: (...args: any[]) => mockGetVenuesDelta(...args),
}));
jest.mock('../../lib/venuesPersistentCache', () => ({
  readVenueScope: jest.fn().mockReturnValue(null),
  writeVenueScope: jest.fn(),
  applyVenuesDelta: jest.fn((_c: any, _t: any, upserts: any) => ({ venues: upserts ?? [], syncedAt: '' })),
  clearVenuesCache: jest.fn(),
}));
jest.mock('../../services/cities', () => ({ getCities: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('../../services/checkins', () => ({ getActiveFriendCheckins: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('../../services/friends', () => ({ getFriendIds: jest.fn().mockResolvedValue([]) }));
jest.mock('../../components/CityPickerModal', () => ({ CityPickerModal: () => null }));

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { MapViewScreen } from '../MapViewScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetVenuesDelta.mockResolvedValue({
    data: { upserts: VENUE_ROWS, tombstone_ids: [], synced_at: '2026-06-16T00:00:00Z' },
    error: null,
  });
  // Only Hall B (id 2) has an approved coach.
  mockGetCoachingVenueIds.mockResolvedValue({ data: [2], error: null });
});

describe('MapViewScreen — Coaching filter (F063)', () => {
  it('renders the Coaching filter chip', async () => {
    const { getByText } = render(<MapViewScreen hideTabBar />);
    await waitFor(() => expect(getByText('Coaching')).toBeTruthy());
  });

  it('filters the list to venues with an approved coach when the chip is active', async () => {
    const { getByText, getByTestId, queryByText } = render(<MapViewScreen hideTabBar />);
    await waitFor(() => expect(getByTestId('venue-list')).toBeTruthy());
    // Both venues show before filtering.
    await waitFor(() => expect(getByText('Hall B')).toBeTruthy());

    await act(async () => { fireEvent.press(getByText('Coaching')); });

    await waitFor(() => expect(getByText('Hall B')).toBeTruthy());
    expect(queryByText('Park A')).toBeNull();
  });
});
