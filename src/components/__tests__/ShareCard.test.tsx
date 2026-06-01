import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ShareCard } from '../ShareCard';

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
  }),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockS.mockImplementation((key: string) => key);
});

describe('ShareCard', () => {
  const defaultProps = {
    title: 'First Serve',
    subtitle: 'Badge unlocked!',
    icon: 'zap',
    onClose: jest.fn(),
  };

  it('renders card with title and subtitle', () => {
    const { getByText, getByTestId } = render(<ShareCard {...defaultProps} />);
    expect(getByTestId('share-card')).toBeTruthy();
    expect(getByText('First Serve')).toBeTruthy();
    expect(getByText('Badge unlocked!')).toBeTruthy();
  });

  it('renders stat when provided', () => {
    const { getByText } = render(<ShareCard {...defaultProps} stat="+10 XP" />);
    expect(getByText('+10 XP')).toBeTruthy();
  });

  it('renders share and close buttons', () => {
    const { getByTestId } = render(<ShareCard {...defaultProps} />);
    expect(getByTestId('share-card-share')).toBeTruthy();
    expect(getByTestId('share-card-close')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<ShareCard {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByTestId('share-card-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders TT PORTAL branding', () => {
    const { getByText } = render(<ShareCard {...defaultProps} />);
    expect(getByText('TT PORTAL')).toBeTruthy();
  });
});
