import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { CityGuideScreen } from '../CityGuideScreen';
import { useCityGuideQuery } from '../../hooks/queries/useCityGuideQuery';

jest.mock('../../hooks/queries/useCityGuideQuery', () => ({ useCityGuideQuery: jest.fn() }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('../../contexts/I18nProvider', () => ({ getDateLocale: () => 'en-US' }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: {
    bg: '#fff', bgAlt: '#f7f7f7', borderLight: '#eee', text: '#111', textMuted: '#444',
    textFaint: '#999', textOnPrimary: '#fff', primary: '#14532d', primaryMid: '#166534', accent: '#c2410c',
  } }),
}));
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key, lang: 'en' }) }));
jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockHook = useCityGuideQuery as jest.Mock;

const GUIDE = {
  city: { id: 7, name: 'Cluj-Napoca', county: 'CJ', country_code: 'RO', country_name: 'Romania', lat: 46.7, lng: 23.6 },
  venue_count: 12,
  outdoor: [{ id: 1, name: 'Central Park', type: 'parc_exterior', free_access: true, lat: 46.7, lng: 23.6, avg_rating: 4.5, review_count: 8, checkin_count: 30 }],
  indoor: [{ id: 2, name: 'Sports Hall', type: 'sala_indoor', free_access: false, lat: 46.7, lng: 23.6, avg_rating: 0, review_count: 0, checkin_count: 5 }],
  free_access: [{ id: 1, name: 'Central Park', type: 'parc_exterior', free_access: true, lat: 46.7, lng: 23.6, avg_rating: 4.5, review_count: 8, checkin_count: 30 }],
  events: [{ id: 99, title: 'Weekend Open', starts_at: '2026-06-20T10:00:00Z', venue_id: 1, venue_name: 'Central Park' }],
};

beforeEach(() => jest.clearAllMocks());

describe('CityGuideScreen (F015)', () => {
  it('shows a loading spinner while fetching', () => {
    mockHook.mockReturnValue({ data: null, isLoading: true, isError: false });
    const { queryByText } = render(<CityGuideScreen cityId="7" />);
    expect(queryByText('Cluj-Napoca')).toBeNull();
  });

  it('shows a not-found state on error / missing city', () => {
    mockHook.mockReturnValue({ data: null, isLoading: false, isError: true });
    const { getByText } = render(<CityGuideScreen cityId="7" />);
    expect(getByText('cityGuideNotFound')).toBeTruthy();
  });

  it('renders the hero, venue lists and events for a logged-out visitor', () => {
    mockHook.mockReturnValue({ data: GUIDE, isLoading: false, isError: false });
    const { getByText, getAllByText, getByTestId } = render(<CityGuideScreen cityId="7" />);
    expect(getByText('Cluj-Napoca')).toBeTruthy();
    expect(getByText('cityGuideVenuesCount')).toBeTruthy();
    // Central Park is both outdoor + free-access → appears in both sections.
    expect(getAllByText('Central Park').length).toBeGreaterThan(0);
    expect(getByText('Sports Hall')).toBeTruthy();
    expect(getByText('Weekend Open')).toBeTruthy();
    expect(getByTestId('city-guide-event-99')).toBeTruthy();
  });

  it('opens a venue when its card is tapped', () => {
    mockHook.mockReturnValue({ data: GUIDE, isLoading: false, isError: false });
    const { getByTestId } = render(<CityGuideScreen cityId="7" />);
    fireEvent.press(getByTestId('city-guide-venue-2'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/venue/[id]', params: { id: '2' } });
  });
});
