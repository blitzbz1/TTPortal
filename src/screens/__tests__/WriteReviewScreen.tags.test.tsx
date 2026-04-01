import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    user: { id: 'u1', user_metadata: { full_name: 'Test' } },
  }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../services/venues', () => ({
  getVenueById: jest.fn().mockResolvedValue({ data: { name: 'Test Venue' } }),
}));

jest.mock('../../services/reviews', () => ({
  createReview: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('../../lib/auth-utils', () => ({
  safeErrorMessage: jest.fn(() => 'error'),
}));

const mockHapticLight = jest.fn();
jest.mock('../../lib/haptics', () => ({
  hapticLight: () => mockHapticLight(),
}));

import { WriteReviewScreen } from '../WriteReviewScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockS.mockImplementation((key: string) => key);
});

describe('WriteReviewScreen — tags', () => {
  it('renders all 8 tag pills', () => {
    const { getByTestId } = render(<WriteReviewScreen venueId="1" />);
    expect(getByTestId('tag-goodTables')).toBeTruthy();
    expect(getByTestId('tag-newPaddles')).toBeTruthy();
    expect(getByTestId('tag-goodLighting')).toBeTruthy();
    expect(getByTestId('tag-crowded')).toBeTruthy();
    expect(getByTestId('tag-quiet')).toBeTruthy();
    expect(getByTestId('tag-friendlyStaff')).toBeTruthy();
    expect(getByTestId('tag-clean')).toBeTruthy();
    expect(getByTestId('tag-nearbyParking')).toBeTruthy();
  });

  it('toggles a tag on press', () => {
    const { getByTestId } = render(<WriteReviewScreen venueId="1" />);
    const tag = getByTestId('tag-goodTables');

    // First press selects
    fireEvent.press(tag);
    expect(mockHapticLight).toHaveBeenCalledTimes(1);

    // Second press deselects
    fireEvent.press(tag);
    expect(mockHapticLight).toHaveBeenCalledTimes(2);
  });

  it('renders TAGS section label', () => {
    const { getByText } = render(<WriteReviewScreen venueId="1" />);
    expect(getByText('fieldTags')).toBeTruthy();
  });
});
