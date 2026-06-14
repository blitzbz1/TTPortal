import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { MapRainBanner } from '../MapRainBanner';
import { useWeatherQuery } from '../../features/weather';

jest.mock('../../features/weather', () => ({ useWeatherQuery: jest.fn() }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: { bluePale: '#eef', blue: '#1e40af', text: '#111', textMuted: '#444', textOnPrimary: '#fff' } }),
}));
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key }) }));
jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockHook = useWeatherQuery as jest.Mock;
const props = { lat: 44, lng: 26, indoorActive: false, onShowIndoor: jest.fn() };

beforeEach(() => jest.clearAllMocks());

describe('MapRainBanner (F013)', () => {
  it('renders nothing when rain is not imminent', () => {
    mockHook.mockReturnValue({ data: { raining_now: false, rain_at: null } });
    const { queryByTestId } = render(<MapRainBanner {...props} />);
    expect(queryByTestId('map-rain-banner')).toBeNull();
  });

  it('renders nothing when the indoor filter is already active', () => {
    mockHook.mockReturnValue({ data: { raining_now: true, rain_at: null } });
    const { queryByTestId } = render(<MapRainBanner {...props} indoorActive />);
    expect(queryByTestId('map-rain-banner')).toBeNull();
  });

  it('shows the forecast-hour banner when rain is expected later', () => {
    mockHook.mockReturnValue({ data: { raining_now: false, rain_at: '2026-06-13T17:00' } });
    const { getByText } = render(<MapRainBanner {...props} />);
    expect(getByText('weatherRainBanner')).toBeTruthy();
  });

  it('applies the indoor filter and dismisses on tap', () => {
    const onShowIndoor = jest.fn();
    mockHook.mockReturnValue({ data: { raining_now: true, rain_at: null } });
    const { getByTestId, queryByTestId } = render(
      <MapRainBanner {...props} onShowIndoor={onShowIndoor} />,
    );
    fireEvent.press(getByTestId('map-rain-show-indoor'));
    expect(onShowIndoor).toHaveBeenCalledTimes(1);
    expect(queryByTestId('map-rain-banner')).toBeNull();
  });

  it('dismisses for the session via the X', () => {
    mockHook.mockReturnValue({ data: { raining_now: true, rain_at: null } });
    const { getByTestId, queryByTestId } = render(<MapRainBanner {...props} />);
    fireEvent.press(getByTestId('map-rain-dismiss'));
    expect(queryByTestId('map-rain-banner')).toBeNull();
  });
});
