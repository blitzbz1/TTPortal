import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { VenueRegularsRow } from '../VenueRegularsRow';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: { purplePale: '#f3e8ff', purple: '#7c3aed', purpleMid: '#a855f7', purpleDim: '#581c87', textOnPrimary: '#fff', textMuted: '#444', text: '#111', bgAlt: '#1a1d1a', bgMuted: '#232623' } }),
}));
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key }) }));
jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('VenueRegularsRow (F014)', () => {
  it('renders nothing when there are no regulars', () => {
    expect(render(<VenueRegularsRow regulars={null} />).toJSON()).toBeNull();
    expect(render(<VenueRegularsRow regulars={{ count: 0, regulars: [] }} />).toJSON()).toBeNull();
  });

  it('renders the count and avatars, and opens a player profile on tap', () => {
    const { getByTestId, getByText } = render(
      <VenueRegularsRow
        regulars={{
          count: 2,
          regulars: [
            { user_id: 'u1', full_name: 'Dana Pop', avatar_url: null },
            { user_id: 'u2', full_name: 'Radu Ion', avatar_url: null },
          ],
        }}
      />,
    );
    expect(getByText('venueRegularsTitle · 2')).toBeTruthy();
    expect(getByTestId('regular-u1')).toBeTruthy();
    fireEvent.press(getByTestId('regular-u2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(protected)/player/[userId]', params: { userId: 'u2' } });
  });
});
