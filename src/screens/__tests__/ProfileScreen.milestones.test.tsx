// F053 — Milestones strip (earned chips + next-locked ghost) on the profile.

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
      return args.reduce<string>(
        (acc, a, i) => acc.replace(`{${i}}`, String(a)),
        raw,
      );
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

const mockMilestones = jest.fn();
jest.mock('../../features/milestones', () => {
  const actual = jest.requireActual('../../features/milestones');
  return {
    ...actual,
    useMilestonesQuery: () => ({ data: mockMilestones() }),
  };
});

jest.mock('../../features/challenges', () => ({ useBadgeProgress: () => ({ progressRows: [] }) }));
jest.mock('../../features/matches', () => ({
  usePlayerMatchesQuery: () => ({ data: [] }),
  useRivalsQuery: () => ({ data: [] }),
  summarizeMatches: () => ({ wins: 0, losses: 0, total: 0 }),
}));
jest.mock('../../features/ratings', () => ({ usePlayerRatingQuery: () => ({ data: null }) }));
jest.mock('../../features/findPlayers', () => ({ sendMatchInvite: jest.fn().mockResolvedValue({ error: null }) }));
const mockHomeVenue = jest.fn();
jest.mock('../../features/venueIntel', () => ({
  useHomeVenueQuery: () => ({ data: mockHomeVenue() }),
  useHomeVenueSuggestionQuery: () => ({ data: null }),
  homeVenueQueryKey: (id: string | undefined) => ['home-venue', id],
}));
jest.mock('../../components/VenuePickerModal', () => {
  const { View } = require('react-native');
  return {
    VenuePickerModal: ({ visible }: { visible: boolean }) => (
      visible ? <View testID="venue-picker-modal" /> : null
    ),
  };
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

describe('ProfileScreen — milestones strip (F053)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStats.mockReturnValue({
      total_checkins: 0,
      unique_venues: 0,
      total_hours_played: 0,
      reviews_written: 0,
      member_since: null,
      current_streak: 0,
      best_streak: 0,
    });
    mockMilestones.mockReturnValue([]);
    mockHomeVenue.mockReturnValue(null);
  });

  it('hides the strip when there are no earned milestones and no measurable ghost', () => {
    mockMilestones.mockReturnValue([]);
    const { queryByTestId } = render(<ProfileScreen hideTabBar />);
    expect(queryByTestId('profile-milestones-strip')).toBeNull();
  });

  it('renders an earned-milestone chip from a user_milestones row', () => {
    mockMilestones.mockReturnValue([{ milestone_key: 'checkin_10', achieved_at: '2026-06-16T00:00:00Z' }]);
    mockStats.mockReturnValue({
      total_checkins: 12,
      unique_venues: 2,
      total_hours_played: 5,
      reviews_written: 0,
      member_since: null,
      current_streak: 0,
      best_streak: 0,
    });
    const { getByTestId } = render(<ProfileScreen hideTabBar />);
    expect(getByTestId('profile-milestones-strip')).toBeTruthy();
    expect(getByTestId('milestone-earned-checkin_10')).toBeTruthy();
  });

  it('shows the next locked ghost with progress (e.g. "38/50 venues" style)', () => {
    // 38 distinct venues, nothing earned → the closest unearned ghost surfaces.
    mockMilestones.mockReturnValue([]);
    mockStats.mockReturnValue({
      total_checkins: 38,
      unique_venues: 38,
      total_hours_played: 42,
      reviews_written: 0,
      member_since: null,
      current_streak: 0,
      best_streak: 0,
    });
    const { getByTestId } = render(<ProfileScreen hideTabBar />);
    const ghost = getByTestId('milestone-ghost');
    expect(ghost).toBeTruthy();
    // hours_50 is the closest (42/50). The "{current}/{threshold}" label renders.
    expect(getByTestId('profile-milestones-strip')).toBeTruthy();
  });

  it('does not show a location ghost beside an earned location achievement', () => {
    mockMilestones.mockReturnValue([
      { milestone_key: 'checkin_10', achieved_at: '2026-06-16T00:00:00Z' },
      { milestone_key: 'venues_10', achieved_at: '2026-06-16T00:00:00Z' },
    ]);
    mockStats.mockReturnValue({
      total_checkins: 10,
      unique_venues: 11,
      total_hours_played: 0,
      reviews_written: 0,
      member_since: null,
      current_streak: 0,
      best_streak: 0,
    });

    const { getByTestId, queryByTestId } = render(<ProfileScreen hideTabBar />);

    expect(getByTestId('milestone-earned-venues_10')).toBeTruthy();
    expect(queryByTestId('milestone-ghost')).toBeNull();
  });

  it('opens the venue picker when an existing home venue is pressed', () => {
    mockHomeVenue.mockReturnValue({ id: 7, name: 'Central Table Tennis Club' });

    const { getByTestId } = render(<ProfileScreen hideTabBar />);
    fireEvent.press(getByTestId('profile-home-venue'));

    expect(getByTestId('venue-picker-modal')).toBeTruthy();
  });

  it('opens the play-profile editor from the separated preference row', () => {
    const { getByTestId, getByText } = render(<ProfileScreen hideTabBar />);

    fireEvent.press(getByTestId('edit-play-profile'));

    expect(getByText('Your play profile')).toBeTruthy();
  });
});
