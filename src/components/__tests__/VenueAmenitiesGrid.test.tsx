import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { VenueAmenitiesGrid } from '../VenueAmenitiesGrid';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => mockUseTheme() }));

jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key }) }));

jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../Card', () => ({
  Card: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

const mockColors = {
  bgAlt: '#fff', text: '#111', textMuted: '#444', textFaint: '#999',
  primaryLight: '#22c55e', primaryMid: '#166534',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
});

describe('VenueAmenitiesGrid (F012)', () => {
  it('renders the section with every amenity row + entry fee', () => {
    const { getByText, getAllByText } = render(
      <VenueAmenitiesGrid amenities={null} onSuggestEdit={jest.fn()} />,
    );
    expect(getByText('amenitiesTitle')).toBeTruthy();
    expect(getByText('amenityRental')).toBeTruthy();
    expect(getByText('amenityEntryLabel')).toBeTruthy();
    // Every row is unknown when amenities is null → 7 booleans + entry fee.
    expect(getAllByText('amenityUnknownTellUs').length).toBe(8);
  });

  it('shows the known value and the entry-fee label', () => {
    const { getByText, queryByTestId } = render(
      <VenueAmenitiesGrid
        amenities={{ rental: true, parking: false, entry_fee: 'free' }}
        onSuggestEdit={jest.fn()}
      />,
    );
    // entry fee resolves to its label key, not the "tell us" prompt.
    expect(getByText('amenityEntryFree')).toBeTruthy();
    expect(queryByTestId('amenity-unknown-rental')).toBeNull();
    expect(queryByTestId('amenity-unknown-entry_fee')).toBeNull();
  });

  it('opens the edit flow when an unknown amenity is tapped', () => {
    const onSuggestEdit = jest.fn();
    const { getByTestId } = render(
      <VenueAmenitiesGrid amenities={{ rental: true }} onSuggestEdit={onSuggestEdit} />,
    );
    fireEvent.press(getByTestId('amenity-unknown-parking'));
    expect(onSuggestEdit).toHaveBeenCalledTimes(1);
  });
});
