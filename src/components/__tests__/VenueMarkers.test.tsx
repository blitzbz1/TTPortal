import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Marker: (props: any) => <View {...props} />,
    Callout: (props: any) => <View {...props} />,
  };
});

import { VenueMarkers } from '../VenueMarkers';
import { lightColors } from '../../theme';

const PIN_STYLES = {
  outer: {}, wrap: {}, friendBadge: {}, arrow: {}, callout: {}, calloutTitle: {}, calloutSub: {},
};

const baseProps = {
  friendVenueIds: new Set<number>(),
  onVenuePress: jest.fn(),
  conditionLabel: () => ({ label: 'Good', color: '#0f0' }),
  typeLabel: (t: string) => t,
  friendsActiveLabel: 'friends active',
  pinStyles: PIN_STYLES,
  colors: lightColors,
};

const VENUES = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: `V${i + 1}`,
  type: 'parc_exterior',
  condition: 'buna',
  lat: 48.2082 + (i % 6) * 0.0004,
  lng: 16.3738 + Math.floor(i / 6) * 0.0004,
}));

describe('VenueMarkers (no clustering — removed 2026-06)', () => {
  it('renders every venue as an individual pin', () => {
    const { UNSAFE_getAllByType } = render(
      <VenueMarkers {...baseProps} venues={VENUES} />,
    );
    const { Marker } = jest.requireMock('react-native-maps');
    expect(UNSAFE_getAllByType(Marker)).toHaveLength(30);
  });

  it('skips venues without coordinates', () => {
    const withGaps = [
      ...VENUES.slice(0, 3),
      { id: 99, name: 'NoGeo', type: 'parc_exterior', condition: null, lat: null, lng: null },
    ];
    const { UNSAFE_getAllByType } = render(
      <VenueMarkers {...baseProps} venues={withGaps} />,
    );
    const { Marker } = jest.requireMock('react-native-maps');
    expect(UNSAFE_getAllByType(Marker)).toHaveLength(3);
  });

  it('does NOT re-render the marker tree when props are referentially stable (T041)', () => {
    let renders = 0;
    const countingTypeLabel = (t: string) => {
      renders += 1;
      return t;
    };
    const props = { ...baseProps, typeLabel: countingTypeLabel, venues: VENUES };
    const { rerender } = render(<VenueMarkers {...props} />);
    const after = renders;
    rerender(<VenueMarkers {...props} />);
    expect(renders).toBe(after); // same props object → memo skips entirely
  });

  it('renders the friend badge path without throwing', () => {
    const { UNSAFE_getAllByType } = render(
      <VenueMarkers
        {...baseProps}
        venues={VENUES.slice(0, 2)}
        friendVenueIds={new Set([1])}
      />,
    );
    const { Marker } = jest.requireMock('react-native-maps');
    expect(UNSAFE_getAllByType(Marker)).toHaveLength(2);
  });

  it('surfaces an anonymous live count only for venues with active check-ins (F010)', () => {
    // The whole marker subtree is hidden from accessibility (T066: 1000+ pins
    // would drown VoiceOver), so every content query must opt into hidden els.
    const opts = { includeHiddenElements: true } as const;
    const { getByText, queryByText, getAllByText } = render(
      <VenueMarkers
        {...baseProps}
        venues={VENUES.slice(0, 3)}
        liveCounts={new Map([[1, 3]])}
        liveHereLabel={(n) => `${n} here now`}
      />,
    );
    // Venue 1 (count 3) — badge "3" + callout "3 here now".
    expect(getAllByText('3', opts).length).toBeGreaterThan(0);
    expect(getByText(/3 here now/, opts)).toBeTruthy();
    // Venues 2 and 3 have no entry → no live count anywhere.
    expect(queryByText(/2 here now/, opts)).toBeNull();
  });
});
