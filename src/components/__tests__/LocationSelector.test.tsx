import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { LocationSelector } from '../LocationSelector';
import type { LocationCity } from '../../lib/locationTypes';

const mockSetSelectedCity = jest.fn();
const mockCompleteInitialLocationSetup = jest.fn();
const mockRefreshCities = jest.fn(async () => {});

function city(id: number, name: string, countryCode: string, countryName: string, venueCount: number): LocationCity {
  return {
    id,
    name,
    county: null,
    country_code: countryCode,
    country_name: countryName,
    admin_area: countryName,
    local_area: null,
    lat: 0,
    lng: 0,
    zoom: 12,
    venue_count: venueCount,
    active: true,
    expansion_status: 'active',
    updated_at: '2026-05-26T00:00:00.000Z',
  };
}

const mockCrowdedRomania = Array.from({ length: 55 }, (_, index) =>
  city(index + 1, `Romania City ${index + 1}`, 'RO', 'Romania', 100 - index),
);
const mockLyon = city(200, 'Lyon', 'FR', 'France', 1);
const mockParis = city(201, 'Paris', 'FR', 'France', 0);
const mockCities = [...mockCrowdedRomania, mockLyon, mockParis];

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    lang: 'en',
    s: (key: string, ...args: string[]) => {
      const strings = require('../../locales/en.json');
      let value = strings[key] || key;
      args.forEach((arg, index) => {
        value = value.replace(`{${index}}`, arg);
      });
      return value;
    },
    sn: (key: string, count: number, ...args: string[]) => {
      const strings = require('../../locales/en.json');
      const variant = count === 1 ? `${key}_one` : key;
      let value = strings[variant] || strings[key] || key;
      [String(count), ...args].forEach((arg, index) => {
        value = value.replace(`{${index}}`, arg);
      });
      return value;
    },
  }),
}));

jest.mock('../../hooks/useSelectedLocation', () => ({
  useSelectedLocation: () => ({
    selectedCountry: { code: 'RO', name: 'Romania', active: true },
    selectedCity: mockCities[0],
    activeCountries: [
      { code: 'RO', name: 'Romania', active: true },
      { code: 'FR', name: 'France', active: true },
    ],
    activeCities: mockCities,
    citiesForSelectedCountry: mockCrowdedRomania,
    loadingCities: false,
    hasCompletedInitialLocationSetup: true,
    refreshCities: mockRefreshCities,
    setSelectedCountry: jest.fn(),
    setSelectedCity: mockSetSelectedCity,
    completeInitialLocationSetup: mockCompleteInitialLocationSetup,
  }),
}));

jest.mock('../Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
  };
});

jest.mock('../BrandLockup', () => {
  const { View } = require('react-native');
  return {
    BrandLockup: () => <View testID="brand-lockup" />,
  };
});

describe('LocationSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters by country before capping featured cities', () => {
    const { getAllByText, getByText, getByTestId, queryByText } = render(
      <LocationSelector visible mode="switcher" onClose={jest.fn()} />,
    );

    expect(queryByText('Lyon')).toBeNull();

    fireEvent.press(getByText('All countries'));
    fireEvent.press(getByTestId('country-option-FR'));

    expect(getAllByText('Lyon').length).toBeGreaterThan(0);
    expect(getAllByText('Paris').length).toBeGreaterThan(0);
  });

  it('surfaces capitals first in the recommended list and caps it to a few', () => {
    const { getAllByText, queryByText } = render(
      <LocationSelector visible mode="switcher" onClose={jest.fn()} />,
    );

    // Paris is the French capital with 0 venues, yet it surfaces over the 55 busier
    // (non-capital) Romanian cities — capitals come first regardless of venue count.
    expect(getAllByText('Paris').length).toBeGreaterThan(0);

    // The list is capped at RECOMMENDED_CITY_LIMIT (10): Paris + the 9 busiest others,
    // so the 10th-busiest Romanian city is not shown.
    expect(queryByText('Romania City 10')).toBeNull();
  });

  it('refreshes the city catalog when opened', () => {
    render(
      <LocationSelector visible mode="switcher" onClose={jest.fn()} />,
    );

    expect(mockRefreshCities).toHaveBeenCalledTimes(1);
  });
});
