// --- Mocks (must be defined before component import) ---

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
}));
jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    session: { user: { id: 'u1' } },
    user: { id: 'u1', user_metadata: { full_name: 'Test User' } },
    isLoading: false,
    signOut: jest.fn(),
  }),
}));
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => require('../../locales/en.json')[key] || key,
    lang: 'en' as const,
    setLang: jest.fn(),
  }),
}));
jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));
jest.mock('../../hooks/useAuthGuard', () => ({
  useAuthGuard: () => true,
}));
jest.mock('../../components/Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({ name, size, color }: { name: string; size: number; color: string }) => (
      <View
        testID={`lucide-icon-${name}`}
        accessibilityHint={`size:${size},color:${color}`}
      />
    ),
  };
});
jest.mock('../../services/profiles', () => ({
  getProfile: jest.fn().mockResolvedValue({
    data: {
      id: 'u1',
      full_name: 'Test User',
      username: 'tuser',
      city: 'Bucharest',
      is_admin: false,
    },
  }),
  getProfileStats: jest.fn().mockResolvedValue({
    data: { total_checkins: 5, events_joined: 2 },
  }),
  updateProfile: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('../../services/equipment', () => ({
  getCurrentEquipmentForUser: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../features/challenges', () => ({
  useBadgeProgress: () => ({
    badgeAwards: [],
    progressRows: [
      { category: 'craft_player', approved_count: 4, completed_count: 4 },
      { category: 'spin_artist', approved_count: 3, completed_count: 3 },
    ],
  }),
}));

 
import React from 'react';
 
import { fireEvent, render, waitFor } from '@testing-library/react-native';
 
import { ProfileScreen } from '../ProfileScreen';

describe('ProfileScreen — badges and online dot removed', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not render hardcoded badge text', async () => {
    const { queryByText } = render(<ProfileScreen hideTabBar />);
    await waitFor(() => {
      expect(queryByText('Active player')).toBeNull();
      expect(queryByText('Top contributor')).toBeNull();
    });
  });

  it('renders user initials in avatar', async () => {
    const { getByText } = render(<ProfileScreen hideTabBar />);
    await waitFor(() => {
      expect(getByText('TU')).toBeTruthy();
    });
  });

  it('opens the Challenges badges tab from the clickable challenge counter', async () => {
    const { findByTestId, getByText } = render(<ProfileScreen hideTabBar />);
    const pill = await findByTestId('profile-challenges-pill');

    expect(getByText('7')).toBeTruthy();
    expect(getByText('Challenges')).toBeTruthy();

    fireEvent.press(pill);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/challenges',
      params: { tab: 'badges' },
    });
  });

  it('does not render the old equipment navigation row below identity', async () => {
    const { queryByText, findByText } = render(<ProfileScreen hideTabBar />);
    expect(await findByText('Equipment setup')).toBeTruthy();
    expect(queryByText('Select equipment')).toBeNull();
  });
});
