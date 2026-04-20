import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
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

jest.mock('../../components/EmptyState', () => ({
  EmptyState: () => null,
}));

jest.mock('../../lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSelection: jest.fn(),
}));

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: { View, Text, ScrollView: require('react-native').ScrollView },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedReaction: jest.fn(),
    withTiming: (v: any) => v,
    runOnJS: (fn: any) => fn,
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
    BounceIn: { duration: () => ({ delay: () => ({}) }) },
    FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  };
});

const mockGetPlayHistory = jest.fn();
jest.mock('../../services/checkins', () => ({
  getPlayHistory: (...args: any[]) => mockGetPlayHistory(...args),
}));

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockSupabaseFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockSupabaseFrom(...args) },
}));

jest.mock('../../lib/motion', () => ({
  Easings: { decelerate: { factory: () => 0 } },
}));

import { PlayHistoryScreen } from '../PlayHistoryScreen';

// Test data
const today = new Date();
const todayStr = today.toISOString();
const yesterdayStr = new Date(today.getTime() - 86400000).toISOString();
const lastWeekStr = new Date(today.getTime() - 8 * 86400000).toISOString();
const lastMonthStr = new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString();

const mockCheckins = [
  { venue_id: 1, venue_name: 'Venue A', started_at: todayStr, ended_at: todayStr, venues: { name: 'Venue A' } },
  { venue_id: 2, venue_name: 'Venue B', started_at: yesterdayStr, ended_at: yesterdayStr, venues: { name: 'Venue B' } },
  { venue_id: 1, venue_name: 'Venue A', started_at: lastWeekStr, ended_at: lastWeekStr, venues: { name: 'Venue A' } },
  { venue_id: 3, venue_name: 'Venue C', started_at: lastMonthStr, ended_at: lastMonthStr, venues: { name: 'Venue C' } },
];

const mockEventParticipations = [
  { event_id: 10, hours_played: '2.5', events: { venue_id: 5, starts_at: todayStr, title: 'Tournament', venues: { name: 'Arena X' } } },
  { event_id: 11, hours_played: 0, events: { venue_id: 6, starts_at: lastMonthStr, title: 'Casual', venues: { name: 'Park Y' } } },
];

function setupMocks() {
  mockUseSession.mockReturnValue({
    user: { id: 'u-1', user_metadata: { full_name: 'Test User' } },
  });

  mockGetPlayHistory.mockResolvedValue({ data: mockCheckins.map((c, i) => ({ ...c, id: i + 1 })) });

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'checkins') return createQueryChain(mockCheckins);
    if (table === 'event_participants') return createQueryChain(mockEventParticipations);
    return createQueryChain();
  });
}

describe('PlayHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockS.mockImplementation((key: string) => key);
  });

  // ── Rendering ──

  it('renders header with title and period buttons', async () => {
    setupMocks();
    const { getByText } = render(<PlayHistoryScreen />);

    await waitFor(() => {
      expect(getByText('playHistoryTitle')).toBeTruthy();
    });
    expect(getByText('periodWeek')).toBeTruthy();
    expect(getByText('periodMonth')).toBeTruthy();
    expect(getByText('periodYear')).toBeTruthy();
    expect(getByText('periodAll')).toBeTruthy();
  });

  it('renders stat pills (checkins, locations, time played)', async () => {
    setupMocks();
    const { getByText } = render(<PlayHistoryScreen />);

    await waitFor(() => {
      expect(getByText('checkins')).toBeTruthy();
      expect(getByText('locations')).toBeTruthy();
      expect(getByText('timePlayed')).toBeTruthy();
    });
  });

  it('renders hours-in-events stat summed from event_participants within the active period', async () => {
    mockUseSession.mockReturnValue({
      user: { id: 'u-1', user_metadata: { full_name: 'Test User' } },
    });
    mockGetPlayHistory.mockResolvedValue({ data: [] });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'event_participants') {
        return createQueryChain([
          { event_id: 1, hours_played: '1.5', events: { venue_id: 5, starts_at: todayStr } },
          { event_id: 2, hours_played: '0.75', events: { venue_id: 5, starts_at: yesterdayStr } },
          { event_id: 3, hours_played: '10', events: { venue_id: 5, starts_at: lastMonthStr } },
        ]);
      }
      return createQueryChain();
    });

    const { getByText, getAllByText } = render(<PlayHistoryScreen />);

    await waitFor(() => {
      expect(getByText('hoursInEvents')).toBeTruthy();
      // 1.5 + 0.75 = 2.25 -> "2.3h". Also appears in the total "timePlayed" pill
      // since checkin hours are 0 in this scenario.
      expect(getAllByText('2.3h').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('formats sub-hour event totals as minutes', async () => {
    mockUseSession.mockReturnValue({
      user: { id: 'u-1', user_metadata: { full_name: 'Test User' } },
    });
    mockGetPlayHistory.mockResolvedValue({ data: [] });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'event_participants') {
        return createQueryChain([
          { event_id: 1, hours_played: '0.5', events: { venue_id: 5, starts_at: todayStr } },
        ]);
      }
      return createQueryChain();
    });

    const { getAllByText } = render(<PlayHistoryScreen />);
    await waitFor(() => {
      expect(getAllByText('30min').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the calendar with weekday headers', async () => {
    setupMocks();
    const { getAllByText } = render(<PlayHistoryScreen />);

    await waitFor(() => {
      // L M M J V S D (Mon-Sun in Romanian)
      expect(getAllByText('L').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('V').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('D').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders calendar month navigation arrows', async () => {
    setupMocks();
    const { getAllByTestId } = render(<PlayHistoryScreen />);

    await waitFor(() => {
      expect(getAllByTestId('icon-chevron-left').length).toBeGreaterThanOrEqual(1);
      expect(getAllByTestId('icon-chevron-right').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders streak bar with flame icon', async () => {
    setupMocks();
    const { getByText, getAllByTestId } = render(<PlayHistoryScreen />);

    await waitFor(() => {
      expect(getByText('playHistoryLabel')).toBeTruthy();
      expect(getAllByTestId('icon-flame').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Period switching ──

  it('switches period when buttons are tapped', async () => {
    setupMocks();
    const { getByText } = render(<PlayHistoryScreen />);

    await waitFor(() => expect(getByText('periodMonth')).toBeTruthy());

    fireEvent.press(getByText('periodMonth'));
    // The button should now be active — stats will recompute
    // We verify by checking it doesn't crash
    expect(getByText('periodMonth')).toBeTruthy();

    fireEvent.press(getByText('periodYear'));
    expect(getByText('periodYear')).toBeTruthy();

    fireEvent.press(getByText('periodAll'));
    expect(getByText('periodAll')).toBeTruthy();
  });

  // ── Calendar day selection ──

  it('selects today by default', async () => {
    setupMocks();
    const { getByText } = render(<PlayHistoryScreen />);

    // Today's date should be selected, showing the day detail
    const todayDate = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
    await waitFor(() => {
      // The day detail header should show today's date
      expect(getByText(todayDate)).toBeTruthy();
    });
  });

  it('today is selected by default showing day detail', async () => {
    setupMocks();
    const { getByText } = render(<PlayHistoryScreen />);

    const todayDate = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
    await waitFor(() => {
      // Day detail header should be visible for today
      expect(getByText(todayDate)).toBeTruthy();
    });
  });

  // ── Day detail ──

  it('shows "no activity" message for days without activities', async () => {
    setupMocks();
    const { getByText, getAllByText } = render(<PlayHistoryScreen />);

    await waitFor(() => expect(getByText('playHistoryLabel')).toBeTruthy());

    // Tap a day that likely has no activity (day 1 if not today)
    const targetDay = new Date().getDate() === 1 ? '2' : '1';
    const dayElements = getAllByText(targetDay);
    if (dayElements.length > 0) {
      fireEvent.press(dayElements[0]);
      await waitFor(() => {
        expect(getByText('noActivity')).toBeTruthy();
      });
    }
  });

  // ── Data fetching ──

  it('fetches play history, checkins, and event participations', async () => {
    setupMocks();
    render(<PlayHistoryScreen />);

    await waitFor(() => {
      expect(mockGetPlayHistory).toHaveBeenCalledWith('u-1', 20, 0);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('checkins');
      expect(mockSupabaseFrom).toHaveBeenCalledWith('event_participants');
    });
  });

  it('does not fetch when user is not logged in', async () => {
    mockUseSession.mockReturnValue({ user: null });
    render(<PlayHistoryScreen />);

    await waitFor(() => {
      expect(mockGetPlayHistory).not.toHaveBeenCalled();
    });
  });

  // ── Calendar navigation ──

  it('navigates to previous month', async () => {
    setupMocks();
    const { getAllByTestId, getByText } = render(<PlayHistoryScreen />);

    await waitFor(() => expect(getByText('playHistoryLabel')).toBeTruthy());

    const prevBtn = getAllByTestId('icon-chevron-left')[0];
    // Get parent touchable
    fireEvent.press(prevBtn);

    // The month title should change to previous month
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const expectedTitle = prevMonth.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
    await waitFor(() => {
      expect(getByText(expectedTitle)).toBeTruthy();
    });
  });
});
