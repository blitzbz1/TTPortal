import React from 'react';
import { render } from '@testing-library/react-native';

import { VenueBusynessBlock } from '../VenueBusynessBlock';
import type { VenueBusyness } from '../../services/venueIntel';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => mockUseTheme() }));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en' }),
}));

jest.mock('../../contexts/I18nProvider', () => ({
  getDateLocale: () => 'en-US',
}));

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
  bg: '#fff', bgAlt: '#fff', bgMuted: '#eee', bgMid: '#ddd', text: '#111', textMuted: '#444',
  textFaint: '#999', textOnPrimary: '#fff', blue: '#1e40af', bluePale: '#eff6ff',
  primary: '#14532d', primaryLight: '#22c55e',
  accent: '#ea580c', accentBright: '#f97316', amberPale: '#fef3c7',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
  mockS.mockImplementation((key: string) => key);
});

const withHistogram: VenueBusyness = {
  live_count: 2,
  sample_size: 30,
  peak_hour: 19,
  histogram: [
    { hour: 18, count: 4 },
    { hour: 19, count: 9 },
    { hour: 20, count: 6 },
  ],
  by_weekday: { '1': [{ hour: 19, count: 5 }] },
};

describe('VenueBusynessBlock (F010)', () => {
  it('renders nothing when busyness is null', () => {
    const { toJSON } = render(<VenueBusynessBlock busyness={null} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the empty state below the sample threshold (histogram null)', () => {
    const { getByText, queryByTestId } = render(
      <VenueBusynessBlock busyness={{ live_count: 1, sample_size: 3, histogram: null }} />,
    );
    expect(getByText('venueBusynessEmpty')).toBeTruthy();
    // No weekday selector when there's no histogram.
    expect(queryByTestId('busyness-dow-0')).toBeNull();
  });

  it('renders the live line + tables count when someone is there', () => {
    const { getByText } = render(
      <VenueBusynessBlock busyness={withHistogram} tablesCount={5} />,
    );
    // mock s returns the key; component concatenates the tables suffix.
    expect(getByText('venueBusynessHereNow · 5 tables')).toBeTruthy();
  });

  it('shows the quiet line when no one is checked in', () => {
    const { getByText } = render(
      <VenueBusynessBlock busyness={{ ...withHistogram, live_count: 0 }} />,
    );
    expect(getByText('venueBusynessQuiet')).toBeTruthy();
  });

  it('renders the weekday selector + peak label when a histogram exists', () => {
    const { getByTestId, getByText } = render(
      <VenueBusynessBlock busyness={withHistogram} />,
    );
    expect(getByTestId('busyness-dow-0')).toBeTruthy();
    expect(getByTestId('busyness-dow-6')).toBeTruthy();
    expect(getByText('venueBusynessPeak')).toBeTruthy();
  });
});
