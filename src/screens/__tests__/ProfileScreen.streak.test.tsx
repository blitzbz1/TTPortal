// F050 — Weekly play streak chip + tap detail on the profile identity card.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
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
    s: (key: string, ...args: unknown[]) => {
      const raw = require('../../locales/en.json')[key] || key;
      return args.length ? raw.replace('{0}', String(args[0])) : raw;
    },
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
jest.mock('../../hooks/useAuthGuard', () => ({ useAuthGuard: () => true }));
jest.mock('../../components/Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({ name }: { name: string }) => <View testID={`lucide-icon-${name}`} />,
  };
});

// Profile query hooks: real profile, streak surfaced via stats hook.
const mockStats = jest.fn();
jest.mock('../../hooks/queries/useProfileQuery', () => ({
  profileQueryKey: (id: string | undefined) => ['profile', id],
  profileStatsQueryKey: (id: string | undefined) => ['profile-stats', id],
  useProfileQuery: () => ({
    data: { id: 'u1', full_name: 'Test User', username: 'ana', city: 'Cluj', is_admin: false },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useProfileStatsQuery: () => ({ data: mockStats() }),
}));

jest.mock('../../features/challenges', () => ({ useBadgeProgress: () => ({ progressRows: [] }) }));
jest.mock('../../features/matches', () => ({
  usePlayerMatchesQuery: () => ({ data: [] }),
  useRivalsQuery: () => ({ data: [] }),
  summarizeMatches: () => ({ wins: 0, losses: 0, total: 0 }),
}));
jest.mock('../../features/ratings', () => ({ usePlayerRatingQuery: () => ({ data: null }) }));
jest.mock('../../features/findPlayers', () => ({ sendMatchInvite: jest.fn().mockResolvedValue({ error: null }) }));
jest.mock('../../features/venueIntel', () => ({
  useHomeVenueQuery: () => ({ data: null }),
  useHomeVenueSuggestionQuery: () => ({ data: null }),
  homeVenueQueryKey: (id: string | undefined) => ['home-venue', id],
}));
// @tanstack/react-query is mocked globally in jest.setup.js (provides a
// no-op useQueryClient) — do not re-mock it here or queryClient.ts breaks.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

describe('ProfileScreen — weekly streak chip (F050)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStats.mockReturnValue({ current_streak: 0, best_streak: 0 });
  });

  it('hides the streak chip when there is no active streak', () => {
    mockStats.mockReturnValue({ current_streak: 0, best_streak: 0 });
    const { queryByTestId } = render(<ProfileScreen hideTabBar />);
    expect(queryByTestId('profile-streak-chip')).toBeNull();
  });

  it('renders the flame streak chip when the streak is active', () => {
    mockStats.mockReturnValue({ current_streak: 6, best_streak: 9 });
    const { getByTestId } = render(<ProfileScreen hideTabBar />);
    expect(getByTestId('profile-streak-chip')).toBeTruthy();
  });

  it('opens the streak detail (current + best) on tap', () => {
    mockStats.mockReturnValue({ current_streak: 6, best_streak: 9 });
    const { getByTestId } = render(<ProfileScreen hideTabBar />);
    expect(() => getByTestId('profile-streak-detail')).toThrow();
    fireEvent.press(getByTestId('profile-streak-chip'));
    const detail = getByTestId('profile-streak-detail');
    expect(detail).toBeTruthy();
  });
});
