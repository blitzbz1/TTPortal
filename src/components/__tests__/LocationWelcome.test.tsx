// Stage 2 (T053): onboarding reaches a zero-venue long-tail city by search
// without shipping the full catalog. The in-tier featured list stays offline;
// only a sparse query enables the debounced server search, whose rows fold in.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { LocationWelcome } from '../LocationWelcome';
import type { LocationCity } from '../../lib/locationTypes';

const mockSetSelectedCity = jest.fn();
const mockCompleteInitialLocationSetup = jest.fn();
const mockRefreshCities = jest.fn(async () => {});
const mockRequestCatalog = jest.fn();

function city(id: number, name: string, countryCode: string, countryName: string, venueCount: number): LocationCity {
  return {
    id, name, county: null, country_code: countryCode, country_name: countryName,
    admin_area: countryName, local_area: null, lat: 0, lng: 0, zoom: 12,
    venue_count: venueCount, active: true, expansion_status: 'active', updated_at: '2026-05-26T00:00:00.000Z',
  };
}

const mockTier = [
  ...Array.from({ length: 8 }, (_, i) => city(i + 1, `Bucharest District ${i + 1}`, 'RO', 'Romania', 50 - i)),
  city(200, 'Paris', 'FR', 'France', 0),
];

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    lang: 'en',
    s: (key: string, ...args: string[]) => {
      const strings = require('../../locales/en.json');
      let value = strings[key] || key;
      args.forEach((arg, index) => { value = value.replace(`{${index}}`, arg); });
      return value;
    },
  }),
}));

jest.mock('../../hooks/useSelectedLocation', () => ({
  useSelectedLocation: () => ({
    activeCountries: [
      { code: 'RO', name: 'Romania', active: true },
      { code: 'FR', name: 'France', active: true },
    ],
    activeCities: mockTier,
    loadingCities: false,
    requestCatalog: mockRequestCatalog,
    refreshCities: mockRefreshCities,
    setSelectedCity: mockSetSelectedCity,
    completeInitialLocationSetup: mockCompleteInitialLocationSetup,
  }),
}));

jest.mock('../Icon', () => {
  const { View } = require('react-native');
  return { Lucide: ({ name }: { name: string }) => <View testID={`icon-${name}`} /> };
});
jest.mock('../BrandLockup', () => {
  const { View } = require('react-native');
  return { BrandLockup: () => <View testID="brand-lockup" /> };
});
jest.mock('../LanguagePicker', () => {
  const { View } = require('react-native');
  return { LanguagePicker: () => <View testID="language-picker" /> };
});

describe('LocationWelcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the featured in-tier list from activeCities', () => {
    const { getAllByText } = render(<LocationWelcome visible />);
    expect(getAllByText('Paris').length).toBeGreaterThan(0); // capital featured
  });

  it('filters the list by the typed query (in-tier client filter)', () => {
    const { getByPlaceholderText, getAllByText, queryByText } = render(<LocationWelcome visible />);
    const input = getByPlaceholderText('Search city or country');
    fireEvent.changeText(input, 'Bucharest');
    expect(getAllByText(/Bucharest District/).length).toBeGreaterThan(0);
    expect(queryByText('Paris')).toBeNull(); // filtered out
  });
});
