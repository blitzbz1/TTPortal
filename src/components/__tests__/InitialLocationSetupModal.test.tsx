import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { InitialLocationSetupModal } from '../InitialLocationSetupModal';
import type { LocationCity } from '../../lib/locationTypes';

const mockSetSelectedCountry = jest.fn();
const mockSetSelectedCity = jest.fn();
const mockCompleteInitialLocationSetup = jest.fn();
const mockRefreshCities = jest.fn(async () => {});

const cities: LocationCity[] = [
  {
    id: -1002,
    name: 'Berlin',
    county: null,
    country_code: 'DE',
    country_name: 'Germany',
    admin_area: 'Berlin',
    local_area: null,
    lat: 52.52,
    lng: 13.405,
    zoom: 11,
    venue_count: 0,
    active: true,
    expansion_status: 'researching',
    updated_at: '2026-05-15T00:00:00.000Z',
  },
];

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    lang: 'en',
    setLang: jest.fn(),
    s: (key: string, ...args: string[]) => {
      const strings = require('../../locales/en.json');
      let value = strings[key] || key;
      args.forEach((arg, index) => {
        value = value.replace(`{${index}}`, arg);
      });
      return value;
    },
  }),
}));

jest.mock('../../hooks/useSelectedLocation', () => ({
  useSelectedLocation: () => ({
    selectedCountry: { code: 'DE', name: 'Germany', active: true },
    selectedCity: cities[0],
    activeCountries: [
      { code: 'RO', name: 'Romania', active: true },
      { code: 'DE', name: 'Germany', active: true },
    ],
    activeCities: cities,
    citiesForSelectedCountry: cities,
    loadingCities: false,
    hasCompletedInitialLocationSetup: false,
    refreshCities: mockRefreshCities,
    setSelectedCountry: mockSetSelectedCountry,
    setSelectedCity: mockSetSelectedCity,
    completeInitialLocationSetup: mockCompleteInitialLocationSetup,
  }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 52.52, longitude: 13.405 },
  })),
}));

jest.mock('../../components/Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InitialLocationSetupModal', () => {
  it('renders first-run country and city choices', () => {
    const { getAllByText, getByText } = render(<InitialLocationSetupModal visible />);

    expect(getByText('Discover public tables, clubs, events, and players')).toBeTruthy();
    expect(getAllByText('Germany').length).toBeGreaterThan(0);
    expect(getAllByText('Berlin').length).toBeGreaterThan(0);
    expect(getByText('Explore Berlin')).toBeTruthy();
  });

  it('persists setup completion from the primary action', () => {
    const { getByText } = render(<InitialLocationSetupModal visible />);

    fireEvent.press(getByText('Explore Berlin'));

    expect(mockSetSelectedCity).toHaveBeenCalledWith(cities[0]);
    expect(mockCompleteInitialLocationSetup).toHaveBeenCalledTimes(1);
  });

  it('stages selected city without persisting while a city is pressed', () => {
    const { getAllByText } = render(<InitialLocationSetupModal visible />);

    fireEvent.press(getAllByText('Berlin')[1]);

    expect(mockSetSelectedCity).not.toHaveBeenCalled();
    expect(mockCompleteInitialLocationSetup).not.toHaveBeenCalled();
  });
});
