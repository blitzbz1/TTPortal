import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    user: { id: 'u1', user_metadata: { full_name: 'John Doe' } },
    signOut: jest.fn(),
  }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en', setLang: jest.fn() }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
    mode: 'light',
    setMode: jest.fn(),
  }),
}));

jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../components/Card', () => ({
  Card: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('../../components/SkeletonLoader', () => ({
  ProfileSkeleton: () => null,
}));

jest.mock('../../services/profiles', () => ({
  getProfile: jest.fn().mockResolvedValue({
    data: { id: 'u1', full_name: 'John Doe', username: 'johnd', city: 'Bucharest', is_admin: false },
  }),
  getProfileStats: jest.fn().mockResolvedValue({
    data: { total_checkins: 15, unique_venues: 8, events_joined: 3 },
  }),
  updateProfile: jest.fn().mockResolvedValue({ data: {}, error: null }),
}));

jest.mock('../../services/reviews', () => ({
  getUserReviewCount: jest.fn().mockResolvedValue({ data: 7, error: null }),
}));

jest.mock('../../services/friends', () => ({
  getFriends: jest.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null }),
}));

import { ProfileScreen } from '../ProfileScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockS.mockImplementation((key: string) => key);
});

describe('ProfileScreen — enriched', () => {
  it('renders badges section title after data loads', async () => {
    const { findByText } = render(<ProfileScreen />);
    expect(await findByText('badgesTitle')).toBeTruthy();
  });

  it('renders navigation links after data loads', async () => {
    const { findByText } = render(<ProfileScreen />);
    expect(await findByText('playHistory')).toBeTruthy();
    expect(await findByText('settings')).toBeTruthy();
  });

  it('renders unlocked badge items based on stats', async () => {
    const { findByText } = render(<ProfileScreen />);
    // User has 15 checkins so "First Serve" should be unlocked
    expect(await findByText('badgeFirstServe')).toBeTruthy();
    // User has 8 venues so "Explorer" should be unlocked
    expect(await findByText('badgeExplorer')).toBeTruthy();
    // User has 7 reviews so "Reviewer" should be unlocked
    expect(await findByText('badgeReviewer')).toBeTruthy();
  });
});
