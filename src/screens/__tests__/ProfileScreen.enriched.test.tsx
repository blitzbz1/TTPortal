import React from 'react';
import { render } from '@testing-library/react-native';

import { ProfileScreen } from '../ProfileScreen';

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
  updateProfile: jest.fn().mockResolvedValue({ data: {}, error: null }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockS.mockImplementation((key: string) => key);
});

describe('ProfileScreen — enriched', () => {
  it('does not render the old profile badges or challenge widgets', async () => {
    const { findByText, queryByText } = render(<ProfileScreen />);
    expect(await findByText('friends')).toBeTruthy();
    expect(queryByText('badgesTitle')).toBeNull();
    expect(queryByText('badgeFirstServe')).toBeNull();
    expect(queryByText('challengeActiveTitle')).toBeNull();
  });

  it('renders navigation links after data loads', async () => {
    const { findByText } = render(<ProfileScreen />);
    expect(await findByText('playHistory')).toBeTruthy();
    expect(await findByText('settings')).toBeTruthy();
  });

});
