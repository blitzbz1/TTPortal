const mockGetVenues = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
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
   
  const MockMapView = (props: any) => <View {...props} />;
  MockMapView.Marker = MockMapView;
  MockMapView.Callout = MockMapView;
  return {
    __esModule: true,
    default: MockMapView,
     
    Marker: (props: any) => <View {...props} />,
     
    Callout: (props: any) => <View {...props} />,
  };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 44.4, longitude: 26.1 } }),
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

// eslint-disable-next-line import/first
import React from 'react';
// eslint-disable-next-line import/first
import { render, waitFor, fireEvent } from '@testing-library/react-native';
// eslint-disable-next-line import/first
import { MapViewScreen } from '../MapViewScreen';

describe('MapViewScreen — error + retry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows error message and retry button when fetch fails', async () => {
    mockGetVenues.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<MapViewScreen hideTabBar />);

    await waitFor(() => {
      expect(getByText('Could not load venues')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  it('retries fetch when retry button pressed', async () => {
    mockGetVenues.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<MapViewScreen hideTabBar />);

    await waitFor(() => {
      expect(getByText('Retry')).toBeTruthy();
    });

    mockGetVenues.mockResolvedValueOnce({ data: [] });
    fireEvent.press(getByText('Retry'));

    expect(mockGetVenues).toHaveBeenCalledTimes(2);
  });
});
