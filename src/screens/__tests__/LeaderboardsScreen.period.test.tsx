import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { LeaderboardsScreen } from '../LeaderboardsScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
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

jest.mock('../../components/CityPickerModal', () => ({
  CityPickerModal: () => null,
}));

const mockGetLeaderboard = jest.fn().mockResolvedValue({ data: [] });
jest.mock('../../services/leaderboard', () => ({
  getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
}));

jest.mock('../../lib/haptics', () => ({
  hapticSelection: jest.fn(),
}));

jest.mock('../../components/SkeletonLoader', () => ({
  LeaderboardSkeleton: () => null,
}));

jest.mock('../../components/EmptyState', () => ({
  EmptyState: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockS.mockImplementation((key: string) => key);
});

describe('LeaderboardsScreen — period toggle', () => {
  it('renders period toggle with "All time" and "This week"', () => {
    const { getByText } = render(<LeaderboardsScreen />);
    expect(getByText('periodAll')).toBeTruthy();
    expect(getByText('periodWeek')).toBeTruthy();
  });

  it('defaults to "all" period', async () => {
    render(<LeaderboardsScreen />);
    // Should call getLeaderboard with 'all' period
    expect(mockGetLeaderboard).toHaveBeenCalled();
    const lastCall = mockGetLeaderboard.mock.calls[0];
    // The period param (3rd arg or last arg)
    expect(lastCall).toContain('all');
  });

  it('switches to weekly when "This week" is pressed', () => {
    const { getByText } = render(<LeaderboardsScreen />);
    fireEvent.press(getByText('periodWeek'));
    // After pressing, getLeaderboard should be called with 'week'
    const calls = mockGetLeaderboard.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toContain('week');
  });
});
