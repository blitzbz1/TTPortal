const mockGetVenues = jest.fn().mockResolvedValue({ data: [
  { id: 1, name: 'Park A', type: 'parc_exterior', city: 'București', lat: 44.4, lng: 26.1, condition: 'buna', venue_stats: null, tables_count: 2, verified: false },
] });

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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
jest.mock('../../services/venues', () => ({
  getVenues: (...args: any[]) => mockGetVenues(...args),
}));
jest.mock('../../services/cities', () => ({
  getCities: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../services/checkins', () => ({
  getActiveFriendCheckins: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../services/friends', () => ({
  getFriendIds: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../components/CityPickerModal', () => ({
  CityPickerModal: () => null,
}));

 
import React from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
 
import { render, waitFor, fireEvent } from '@testing-library/react-native';
 
import { MapViewScreen } from '../MapViewScreen';

describe('MapViewScreen — search clear button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 44.4268, longitude: 26.1025 },
    });
  });

  it('does not show clear button when search is empty', async () => {
    const { queryByTestId } = render(<MapViewScreen hideTabBar />);
    await waitFor(() => {
      expect(queryByTestId('search-clear')).toBeNull();
    });
  });

  it('shows clear button when search has text', async () => {
    const { queryByTestId, getByPlaceholderText } = render(<MapViewScreen hideTabBar />);

    await waitFor(() => {
      expect(getByPlaceholderText('Search venues...')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('Search venues...'), 'test');

    await waitFor(() => {
      expect(queryByTestId('search-clear')).toBeTruthy();
    });
  });

  it('clears search when clear button pressed', async () => {
    const { getByTestId, getByPlaceholderText, queryByTestId } = render(<MapViewScreen hideTabBar />);

    await waitFor(() => {
      expect(getByPlaceholderText('Search venues...')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('Search venues...'), 'test');

    await waitFor(() => {
      expect(getByTestId('search-clear')).toBeTruthy();
    });

    fireEvent.press(getByTestId('search-clear'));

    await waitFor(() => {
      expect(queryByTestId('search-clear')).toBeNull();
    });
  });
});

describe('MapViewScreen - branded current location marker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 44.4268, longitude: 26.1025 },
    });
  });

  it('shows the branded current-location marker after Near Me succeeds', async () => {
    const { getByTestId, queryByTestId } = render(<MapViewScreen hideTabBar />);

    expect(queryByTestId('current-location-marker')).toBeNull();

    await waitFor(() => expect(getByTestId('near-me-map-button')).toBeTruthy());
    fireEvent.press(getByTestId('near-me-map-button'));

    await waitFor(() => {
      expect(getByTestId('current-location-marker')).toBeTruthy();
    });
  });

  it('removes the current-location marker when Near Me is toggled off', async () => {
    const { getByTestId, queryByTestId } = render(<MapViewScreen hideTabBar />);

    await waitFor(() => expect(getByTestId('near-me-map-button')).toBeTruthy());
    fireEvent.press(getByTestId('near-me-map-button'));

    await waitFor(() => expect(getByTestId('current-location-marker')).toBeTruthy());

    fireEvent.press(getByTestId('near-me-map-button'));

    await waitFor(() => {
      expect(queryByTestId('current-location-marker')).toBeNull();
    });
  });

  it('does not show the marker when location permission is denied', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const { getByTestId, queryByTestId } = render(<MapViewScreen hideTabBar />);

    await waitFor(() => expect(getByTestId('near-me-map-button')).toBeTruthy());
    fireEvent.press(getByTestId('near-me-map-button'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(queryByTestId('current-location-marker')).toBeNull();

    alertSpy.mockRestore();
  });
});
