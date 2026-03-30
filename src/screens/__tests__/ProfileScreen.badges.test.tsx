// --- Mocks (must be defined before component import) ---

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
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

// eslint-disable-next-line import/first
import React from 'react';
// eslint-disable-next-line import/first
import { render, waitFor } from '@testing-library/react-native';
// eslint-disable-next-line import/first
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
});
