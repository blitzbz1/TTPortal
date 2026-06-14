import React from 'react';
import { render } from '@testing-library/react-native';

import { WeatherChip } from '../WeatherChip';
import { useWeatherQuery } from '../../features/weather';

jest.mock('../../features/weather', () => ({ useWeatherQuery: jest.fn() }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: { bluePale: '#eef', text: '#111', textMuted: '#444', blue: '#1e40af', amber: '#f59e0b' } }),
}));
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key }) }));
jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockHook = useWeatherQuery as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('WeatherChip (F013)', () => {
  it('renders nothing when there is no data', () => {
    mockHook.mockReturnValue({ data: null });
    const { toJSON } = render(<WeatherChip lat={44} lng={26} />);
    expect(toJSON()).toBeNull();
  });

  it('shows temp + "dry until" when rain is forecast later', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 18, wind_kmh: 10, weather_code: 1, raining_now: false, rain_at: '2026-06-13T17:00', fetched_at: 'x' },
    });
    const { getByText, queryByTestId } = render(<WeatherChip lat={44} lng={26} />);
    expect(getByText('18° · weatherDryUntil')).toBeTruthy();
    expect(queryByTestId('weather-wind-warning')).toBeNull();
  });

  it('shows the raining-now condition', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 15, wind_kmh: 5, weather_code: 61, raining_now: true, rain_at: null, fetched_at: 'x' },
    });
    const { getByText } = render(<WeatherChip lat={44} lng={26} />);
    expect(getByText('15° · weatherRainingNow')).toBeTruthy();
  });

  it('adds a wind warning above the threshold', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 12, wind_kmh: 32, weather_code: 1, raining_now: false, rain_at: null, fetched_at: 'x' },
    });
    const { getByTestId } = render(<WeatherChip lat={44} lng={26} />);
    expect(getByTestId('weather-wind-warning')).toBeTruthy();
  });
});
