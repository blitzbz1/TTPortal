import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { VenueCoachesRow } from '../VenueCoachesRow';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: { bluePale: '#eff6ff', blue: '#1e40af', textOnPrimary: '#fff', textMuted: '#444' } }),
}));
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key }) }));
jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('VenueCoachesRow (F063)', () => {
  it('renders nothing when there are no coaches', () => {
    expect(render(<VenueCoachesRow coaches={null} />).toJSON()).toBeNull();
    expect(render(<VenueCoachesRow coaches={[]} />).toJSON()).toBeNull();
  });

  it('renders the count + avatars and opens a coach profile on tap', () => {
    const { getByTestId, getByText } = render(
      <VenueCoachesRow
        coaches={[
          { coach_id: 1, user_id: 'c1', full_name: 'Ana Coach', avatar_url: null },
          { coach_id: 2, user_id: 'c2', full_name: 'Bo Coach', avatar_url: null },
        ]}
      />,
    );
    expect(getByText('venueCoachesTitle · 2')).toBeTruthy();
    expect(getByTestId('coach-c1')).toBeTruthy();
    fireEvent.press(getByTestId('coach-c2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(protected)/player/[userId]', params: { userId: 'c2' } });
  });
});
