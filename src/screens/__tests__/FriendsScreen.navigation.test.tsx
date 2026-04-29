import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useFocusEffect: (effect: any) => React.useEffect(() => effect(), []),
  };
});

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en' as const }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
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

jest.mock('../../components/EmptyState', () => ({
  EmptyState: () => null,
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: any) => c },
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});

const mockGetFriends = jest.fn();
jest.mock('../../services/friends', () => ({
  getFriends: (...args: any[]) => mockGetFriends(...args),
  getPendingRequests: jest.fn().mockResolvedValue({ data: [] }),
  acceptRequest: jest.fn(),
  declineRequest: jest.fn(),
  findUserByUsername: jest.fn(),
  getFriendshipBetweenUsers: jest.fn(),
  sendRequest: jest.fn(),
}));

const mockGetActiveFriendCheckins = jest.fn();
jest.mock('../../services/checkins', () => ({
  getActiveFriendCheckins: (...args: any[]) => mockGetActiveFriendCheckins(...args),
}));

import { FriendsScreen } from '../FriendsScreen';

describe('FriendsScreen — tap navigates to player profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      user: { id: 'me-1', user_metadata: { full_name: 'Me' } },
    });
    mockGetFriends.mockResolvedValue({
      data: [
        {
          id: 100,
          requester_id: 'me-1',
          addressee_id: 'friend-9',
          status: 'accepted',
          created_at: '2026-01-01',
          requester: { id: 'me-1', full_name: 'Me' },
          addressee: { id: 'friend-9', full_name: 'Andrei P.', city: 'București' },
        },
      ],
      error: null,
    });
    mockGetActiveFriendCheckins.mockResolvedValue({ data: [] });
  });

  it('routes to /(protected)/player/<id> when a friend card is tapped', async () => {
    const { findByText } = render(<FriendsScreen />);
    const friendName = await findByText('Andrei P.');

    fireEvent.press(friendName);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(protected)/player/friend-9');
    });
  });

  it('routes to player profile when a playing-tab friend card is tapped', async () => {
    mockGetActiveFriendCheckins.mockResolvedValue({
      data: [
        {
          user_id: 'friend-9',
          started_at: new Date().toISOString(),
          venues: { name: 'Arena X', city: 'Cluj' },
        },
      ],
    });

    const { findByText } = render(<FriendsScreen />);
    await findByText('Andrei P.');

    fireEvent.press(await findByText(/online/i));

    const playingName = await findByText('Andrei P.');
    fireEvent.press(playingName);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(protected)/player/friend-9');
    });
  });
});
