// --- Mocks (must be defined before component import) ---

import { Alert } from 'react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    session: { user: { id: 'u1' } },
    user: { id: 'u1', user_metadata: { full_name: 'Test User' } },
    isLoading: false,
    signOut: mockSignOut,
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

 
import React from 'react';
 
import { render, waitFor, fireEvent } from '@testing-library/react-native';
 
jest.mock('../../features/matches', () => ({
  usePlayerMatchesQuery: () => ({ data: [] }),
  useRivalsQuery: () => ({ data: [] }),
  summarizeMatches: () => ({ wins: 0, losses: 0, total: 0 }),
}));
jest.mock('../../features/ratings', () => ({ usePlayerRatingQuery: () => ({ data: null }) }));
jest.mock('../../features/findPlayers', () => ({ sendMatchInvite: jest.fn().mockResolvedValue({ error: null }) }));
jest.mock('../../services/matches', () => ({
  getPendingMatches: jest.fn().mockResolvedValue({ data: [] }),
  confirmMatch: jest.fn().mockResolvedValue({ data: {}, error: null }),
  disputeMatch: jest.fn().mockResolvedValue({ data: {}, error: null }),
}));
import { ProfileScreen } from '../ProfileScreen';

describe('ProfileScreen — logout confirmation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows confirmation dialog when logout pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<ProfileScreen hideTabBar />);

    await waitFor(() => {
      expect(getByText('Sign out')).toBeTruthy();
    });
    fireEvent.press(getByText('Sign out'));

    // showConfirm (T054) delegates to Alert.alert with buttons + options.
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign out',
      'Are you sure you want to sign out?',
      expect.any(Array),
      expect.objectContaining({ cancelable: true }),
    );
    alertSpy.mockRestore();
  });
});
