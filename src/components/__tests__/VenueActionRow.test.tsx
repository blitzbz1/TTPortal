import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

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
  hapticLight: jest.fn(),
}));

import { VenueActionRow } from '../VenueActionRow';

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
  redPale: '#fef2f2',
};

beforeEach(() => {
  mockUseTheme.mockReturnValue({ colors: mockColors });
  mockS.mockImplementation((key: string) => key);
});

describe('VenueActionRow', () => {
  const defaultProps = {
    favorited: false,
    checkedIn: false,
    checkinLoading: false,
    onCheckin: jest.fn(),
    onReview: jest.fn(),
    onFavorite: jest.fn(),
    onShare: jest.fn(),
  };

  it('renders all 4 action buttons', () => {
    const { getByTestId } = render(<VenueActionRow {...defaultProps} />);
    expect(getByTestId('venue-action-row')).toBeTruthy();
    expect(getByTestId('action-checkin')).toBeTruthy();
    expect(getByTestId('action-review')).toBeTruthy();
    expect(getByTestId('action-favorite')).toBeTruthy();
    expect(getByTestId('action-share')).toBeTruthy();
  });

  it('calls onCheckin when check-in button is pressed', () => {
    const onCheckin = jest.fn();
    const { getByTestId } = render(
      <VenueActionRow {...defaultProps} onCheckin={onCheckin} />,
    );
    fireEvent.press(getByTestId('action-checkin'));
    expect(onCheckin).toHaveBeenCalledTimes(1);
  });

  it('calls onReview when review button is pressed', () => {
    const onReview = jest.fn();
    const { getByTestId } = render(
      <VenueActionRow {...defaultProps} onReview={onReview} />,
    );
    fireEvent.press(getByTestId('action-review'));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('calls onFavorite when favorite button is pressed', () => {
    const onFavorite = jest.fn();
    const { getByTestId } = render(
      <VenueActionRow {...defaultProps} onFavorite={onFavorite} />,
    );
    fireEvent.press(getByTestId('action-favorite'));
    expect(onFavorite).toHaveBeenCalledTimes(1);
  });

  it('calls onShare when share button is pressed', () => {
    const onShare = jest.fn();
    const { getByTestId } = render(
      <VenueActionRow {...defaultProps} onShare={onShare} />,
    );
    fireEvent.press(getByTestId('action-share'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('shows check-circle icon when checked in', () => {
    const { getByTestId } = render(
      <VenueActionRow {...defaultProps} checkedIn={true} />,
    );
    expect(getByTestId('icon-check-circle')).toBeTruthy();
  });

  it('shows map-pin icon when not checked in', () => {
    const { getByTestId } = render(
      <VenueActionRow {...defaultProps} checkedIn={false} />,
    );
    expect(getByTestId('icon-map-pin')).toBeTruthy();
  });

  it('disables check-in button when loading', () => {
    const onCheckin = jest.fn();
    const { getByTestId } = render(
      <VenueActionRow {...defaultProps} checkinLoading={true} onCheckin={onCheckin} />,
    );
    fireEvent.press(getByTestId('action-checkin'));
    expect(onCheckin).not.toHaveBeenCalled();
  });
});
