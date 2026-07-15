import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { RubberWearCard } from '../RubberWearCard';
import type { RubberWear } from '../../types/database';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

// s(key, ...args) → "key" (or "key:arg0" so we can assert the stepper value).
const mockS = jest.fn((key: string, ...args: string[]) =>
  args.length ? `${key}:${args.join(',')}` : key,
);
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

// DateTimePicker is a native module — stub to a no-op view.
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID="datetimepicker" {...props} />,
  };
});

const mockColors = new Proxy({}, { get: () => '#000000' });

const forehandWear: RubberWear = {
  side: 'forehand',
  installed_at: '2025-01-01',
  expected_hours: 60,
  estimated_hours: 48,
  pct: 80,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
});

describe('RubberWearCard', () => {
  it('renders the wear card with the percent-worn readout', () => {
    const { getByTestId } = render(
      <RubberWearCard side="forehand" wear={forehandWear} onInstall={jest.fn()} />,
    );
    expect(getByTestId('wear-card-forehand')).toBeTruthy();
    // pct is surfaced via the localized "wearPercentWorn" key with the value arg.
    expect(getByTestId('wear-pct-forehand').props.children).toBe('wearPercentWorn:80');
  });

  it('seeds the expected-hours stepper from the wear setting', () => {
    const { getByTestId } = render(
      <RubberWearCard side="forehand" wear={forehandWear} onInstall={jest.fn()} />,
    );
    expect(getByTestId('wear-expected-value-forehand').props.children).toBe('wearHoursValue:60');
  });

  it('adjusts the expected lifespan with the +/- stepper', () => {
    const { getByTestId } = render(
      <RubberWearCard side="forehand" wear={forehandWear} onInstall={jest.fn()} />,
    );
    fireEvent.press(getByTestId('wear-expected-plus-forehand'));
    expect(getByTestId('wear-expected-value-forehand').props.children).toBe('wearHoursValue:70');
    fireEvent.press(getByTestId('wear-expected-minus-forehand'));
    fireEvent.press(getByTestId('wear-expected-minus-forehand'));
    expect(getByTestId('wear-expected-value-forehand').props.children).toBe('wearHoursValue:50');
  });

  it('fires onInstall with the current date when resetting the clock (no change)', () => {
    const onInstall = jest.fn();
    const { getByTestId } = render(
      <RubberWearCard side="backhand" wear={undefined} onInstall={onInstall} />,
    );
    fireEvent.press(getByTestId('wear-reset-backhand'));
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(onInstall).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'backhand', installedAt: iso }),
    );
  });

  it('applies an adjusted expected lifespan via the install handler', () => {
    const onInstall = jest.fn();
    const { getByTestId } = render(
      <RubberWearCard side="forehand" wear={forehandWear} onInstall={onInstall} />,
    );
    // Change the expected hours → the button becomes "save changes" (apply path).
    fireEvent.press(getByTestId('wear-expected-plus-forehand'));
    fireEvent.press(getByTestId('wear-reset-forehand'));
    expect(onInstall).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'forehand', installedAt: '2025-01-01', expectedHours: 70 }),
    );
  });
});
