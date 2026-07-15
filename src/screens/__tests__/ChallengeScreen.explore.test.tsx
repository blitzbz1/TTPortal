// F051: the Challenges screen "Explore" section — quest cards + progress rings,
// the "Find one" map jump (predicate → filter param), and the client-side tier
// celebration when the progress query crosses a target on refetch.
import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';

import { ChallengeScreen } from '../ChallengeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => { const React = require('react'); React.useEffect(cb, [cb]); },
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
}));

jest.mock('../../hooks/useSelectedLocation', () => ({
  useSelectedLocation: () => ({ selectedCity: { id: 7, name: 'Timișoara' } }),
}));

const mockStrings = require('../../locales/en.json');
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    lang: 'en',
    s: (key: string, ...args: string[]) => {
      const template = mockStrings[key] ?? key;
      return args.reduce((text, arg, index) => text.replace(`{${index}}`, arg), template);
    },
    sn: (key: string, count: number, ...args: string[]) => {
      const template = mockStrings[key] ?? key;
      return [String(count), ...args].reduce((text, arg, index) => text.replace(`{${index}}`, arg), template);
    },
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
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

jest.mock('../../components/NotificationBellButton', () => ({ NotificationBellButton: () => null }));
jest.mock('../../components/ErrorState', () => ({
  ErrorState: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('../../features/challenges', () => ({
  completeSelfChallenge: jest.fn(),
  getVisibleChallengeChoices: (choices: any[]) => choices,
  resolveChallengeTitle: (_s: any, c: any) => c.title,
  requiresOtherPlayer: () => false,
  setCurrentSelectedChallenge: jest.fn(),
  useBadgeProgress: () => ({
    approvedCompletions: [],
    approvedChallengeIds: new Set(),
    badgeAwards: [],
    pendingChallengeIds: new Set(),
    progressByCategory: new Map(),
    refresh: jest.fn().mockResolvedValue(undefined),
    progressRows: [],
    error: false,
  }),
  useChallengeChoices: () => ({
    choices: [], error: false, isLoading: false, refresh: jest.fn().mockResolvedValue(undefined),
  }),
}));

// The explorer hook is driven by a mutable fixture so a test can simulate a
// refetch that crosses a tier (the celebration trigger).
let mockExplorerData: any[] = [];
const mockRefetchExplorer = jest.fn();
jest.mock('../../features/explorer', () => {
  const actual = jest.requireActual('../../features/explorer');
  return {
    ...actual,
    useExplorerProgressQuery: () => ({
      data: mockExplorerData,
      isLoading: false,
      isError: false,
      refetch: mockRefetchExplorer,
    }),
  };
});

const quest = (over: Partial<any> = {}) => ({
  key: 'venue_explorer',
  predicate: 'all',
  bronze: 5,
  silver: 10,
  gold: 20,
  city_scoped: true,
  sort: 0,
  progress: 2,
  earned_bronze: false,
  earned_silver: false,
  earned_gold: false,
  ...over,
});

describe('ChallengeScreen — Explore section (F051)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExplorerData = [quest()];
  });

  it('renders the explore quest card with a progress count toward bronze', () => {
    render(<ChallengeScreen hideTabBar />);
    fireEvent.press(screen.getByTestId('explore-top-tab'));

    expect(screen.getByTestId('explorer-quest-venue_explorer')).toBeTruthy();
    // progress 2 / bronze target 5 (the current/active tier).
    expect(screen.getByTestId('explorer-count-venue_explorer')).toHaveTextContent('2/5');
    // bronze pip is NOT earned → locked icon.
    expect(screen.getByTestId('explorer-tier-venue_explorer-bronze')).toBeTruthy();
  });

  it('"Find one" routes to the map tab pre-filtered + city for a park quest', () => {
    mockExplorerData = [quest({ key: 'park_hopper', predicate: 'park', bronze: 3, silver: 7, gold: 15 })];
    render(<ChallengeScreen hideTabBar />);
    fireEvent.press(screen.getByTestId('explore-top-tab'));

    fireEvent.press(screen.getByTestId('explorer-find-park_hopper'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)',
      params: { filter: 'parcuri', city: 'Timișoara' },
    });
  });

  it('shows an earned tier pip once a tier is awarded', () => {
    mockExplorerData = [quest({ progress: 6, earned_bronze: true })];
    render(<ChallengeScreen hideTabBar />);
    fireEvent.press(screen.getByTestId('explore-top-tab'));

    expect(screen.getByTestId('explorer-tier-venue_explorer-bronze-earned')).toBeTruthy();
  });

  it('fires the earned-badge celebration when a tier crosses on refetch', async () => {
    // Baseline: nothing earned (the first settle records the baseline, no modal).
    mockExplorerData = [quest({ progress: 4, earned_bronze: false })];
    const { rerender } = render(<ChallengeScreen hideTabBar />);

    // Simulate a check-in elsewhere bumping the count past bronze: the query
    // result now reports bronze earned. Re-render to flush the detection effect.
    await act(async () => {
      mockExplorerData = [quest({ progress: 5, earned_bronze: true })];
      rerender(<ChallengeScreen hideTabBar />);
    });

    await waitFor(() => {
      expect(screen.getByText(mockStrings.challengeBadgeUnlocked)).toBeTruthy();
    });
  });
});
