import React from 'react';
import { render } from '@testing-library/react-native';

import { WeatherChip } from '../WeatherChip';
import { useWeatherQuery } from '../../features/weather';

jest.mock('../../features/weather', () => ({ useWeatherQuery: jest.fn() }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: {
    bluePale: '#eef', text: '#111', textMuted: '#444', blue: '#1e40af', amber: '#f59e0b', amberDeep: '#b45309',
  } }),
}));
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key }) }));
jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockHook = useWeatherQuery as jest.Mock;

const HOURLY = [
  { time: '2026-06-13T15:00', temp_c: 20, weather_code: 0, precipitation_probability: 0, wind_kmh: 10 },
  { time: '2026-06-13T16:00', temp_c: 19, weather_code: 61, precipitation_probability: 80, wind_kmh: 12 },
];

beforeEach(() => jest.clearAllMocks());

describe('WeatherChip (F013)', () => {
  it('renders nothing when there is no data', () => {
    mockHook.mockReturnValue({ data: null });
    const { toJSON } = render(<WeatherChip lat={44} lng={26} />);
    expect(toJSON()).toBeNull();
  });

  it('shows temp + "dry until" and always shows wind', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 18, wind_kmh: 10, weather_code: 1, raining_now: false, rain_at: '2026-06-13T17:00', hourly: [], fetched_at: 'x' },
    });
    const { getByText, getByTestId } = render(<WeatherChip lat={44} lng={26} />);
    expect(getByText('18° · weatherDryUntil')).toBeTruthy();
    expect(getByTestId('weather-wind')).toBeTruthy(); // wind shown even when calm
  });

  it('shows the raining-now condition', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 15, wind_kmh: 5, weather_code: 61, raining_now: true, rain_at: null, hourly: [], fetched_at: 'x' },
    });
    const { getByText } = render(<WeatherChip lat={44} lng={26} />);
    expect(getByText('15° · weatherRainingNow')).toBeTruthy();
  });

  it('shows wind (still rendered above the windy threshold)', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 12, wind_kmh: 32, weather_code: 1, raining_now: false, rain_at: null, hourly: [], fetched_at: 'x' },
    });
    const { getByTestId } = render(<WeatherChip lat={44} lng={26} />);
    expect(getByTestId('weather-wind')).toBeTruthy();
  });

  it('omits the wind row when wind is unknown', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 12, wind_kmh: null, weather_code: 1, raining_now: false, rain_at: null, hourly: [], fetched_at: 'x' },
    });
    const { queryByTestId } = render(<WeatherChip lat={44} lng={26} />);
    expect(queryByTestId('weather-wind')).toBeNull();
  });

  it('renders the next-hours forecast strip', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 18, wind_kmh: 10, weather_code: 1, raining_now: false, rain_at: null, hourly: HOURLY, fetched_at: 'x' },
    });
    const { getByTestId, getByText } = render(<WeatherChip lat={44} lng={26} />);
    expect(getByTestId('weather-forecast')).toBeTruthy();
    expect(getByTestId('weather-hour-15:00')).toBeTruthy();
    expect(getByTestId('weather-hour-16:00')).toBeTruthy();
    expect(getByText('20°')).toBeTruthy(); // 15:00 temp
  });

  it('omits the forecast strip when there are no hours', () => {
    mockHook.mockReturnValue({
      data: { temp_c: 18, wind_kmh: 10, weather_code: 1, raining_now: false, rain_at: null, hourly: [], fetched_at: 'x' },
    });
    const { queryByTestId } = render(<WeatherChip lat={44} lng={26} />);
    expect(queryByTestId('weather-forecast')).toBeNull();
  });
});
