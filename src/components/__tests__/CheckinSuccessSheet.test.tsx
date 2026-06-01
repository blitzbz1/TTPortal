import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { CheckinSuccessSheet } from '../CheckinSuccessSheet';
import { hapticSuccess } from '../../lib/haptics';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS }),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../lib/haptics', () => ({
  hapticSuccess: jest.fn(),
}));

const mockColors = {
  bg: '#fafaf8',
  bgAlt: '#ffffff',
  bgMuted: '#f4f4ef',
  bgMid: '#ecece4',
  text: '#111810',
  textMuted: '#4a4f47',
  textFaint: '#9ca39a',
  textOnPrimary: '#ffffff',
  border: '#e2e4de',
  borderLight: '#eceee8',
  primary: '#14532d',
  primaryMid: '#166534',
  primaryLight: '#22c55e',
  primaryDim: '#dcfce7',
  primaryPale: '#f0fdf4',
  accent: '#c2410c',
  red: '#ef4444',
  overlayHeavy: 'rgba(0,0,0,0.53)',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
  mockS.mockImplementation((key: string) => key);
});

describe('CheckinSuccessSheet', () => {
  it('does not render when not visible', () => {
    const { queryByText } = render(
      <CheckinSuccessSheet
        visible={false}
        venueName="Test Venue"
        onDismiss={jest.fn()}
      />,
    );
    expect(queryByText('checkinSuccess')).toBeNull();
  });

  it('renders venue name and success message when visible', () => {
    const { getByText } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="ClubPing Bucuresti"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText('checkinSuccess')).toBeTruthy();
    expect(getByText('ClubPing Bucuresti')).toBeTruthy();
  });

  it('shows end time when provided', () => {
    const { getByText } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        endTime="15:30"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText('untilTime 15:30')).toBeTruthy();
  });

  it('shows XP text', () => {
    const { getByText } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText('+10 XP')).toBeTruthy();
  });

  it('calls onDismiss when dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(getByTestId('checkin-success-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback when shown', () => {
    render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        onDismiss={jest.fn()}
      />,
    );
    expect(hapticSuccess).toHaveBeenCalledTimes(1);
  });
});
