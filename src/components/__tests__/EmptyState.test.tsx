import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { EmptyState } from '../EmptyState';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
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
  redPale: '#fef2f2',
};

beforeEach(() => {
  mockUseTheme.mockReturnValue({ colors: mockColors });
});

describe('EmptyState', () => {
  it('renders icon and title', () => {
    const { getByTestId, getByText } = render(
      <EmptyState icon="heart" title="No favorites" />,
    );
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByTestId('icon-heart')).toBeTruthy();
    expect(getByText('No favorites')).toBeTruthy();
  });

  it('renders description when provided', () => {
    const { getByText } = render(
      <EmptyState icon="heart" title="No favorites" description="Save venues for quick access" />,
    );
    expect(getByText('Save venues for quick access')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    const { queryByText } = render(
      <EmptyState icon="heart" title="No favorites" />,
    );
    // No description text should exist beyond the title
    expect(queryByText('Save venues for quick access')).toBeNull();
  });

  it('renders CTA button when ctaLabel and onCtaPress are provided', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(
      <EmptyState icon="map" title="Empty" ctaLabel="Explore map" onCtaPress={onPress} />,
    );
    expect(getByTestId('empty-state-cta')).toBeTruthy();
    expect(getByText('Explore map')).toBeTruthy();
  });

  it('does not render CTA button when ctaLabel is missing', () => {
    const { queryByTestId } = render(
      <EmptyState icon="map" title="Empty" />,
    );
    expect(queryByTestId('empty-state-cta')).toBeNull();
  });

  it('calls onCtaPress when CTA is tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <EmptyState icon="map" title="Empty" ctaLabel="Go" onCtaPress={onPress} />,
    );
    fireEvent.press(getByTestId('empty-state-cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies custom icon color and background', () => {
    const { getByTestId } = render(
      <EmptyState icon="heart" title="Test" iconColor="#ff0000" iconBg="#ffe0e0" />,
    );
    expect(getByTestId('icon-heart').props.color).toBe('#ff0000');
  });
});
