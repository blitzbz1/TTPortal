import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';

import { ChallengeScreen } from '../ChallengeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
}));

const mockStrings = require('../../locales/en.json');
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    lang: 'en',
    s: (key: string, ...args: string[]) => {
      const template = mockStrings[key] ?? key;
      return args.reduce((text, arg, index) => text.replace(`{${index}}`, arg), template);
    },
  }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
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

jest.mock('../../components/NotificationBellButton', () => ({
  NotificationBellButton: () => null,
}));

jest.mock('../../components/ErrorState', () => ({
  ErrorState: ({ title }: any) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

const mockCompleteSelfChallenge = jest.fn();
const mockSetCurrentSelectedChallenge = jest.fn();
const mockRefreshProgress = jest.fn();
const mockRefreshChoices = jest.fn();
let mockChoices: any[] = [];

jest.mock('../../features/challenges', () => ({
  completeSelfChallenge: (...args: any[]) => mockCompleteSelfChallenge(...args),
  getVisibleChallengeChoices: (choices: any[]) => choices,
  resolveChallengeTitle: (_s: any, challenge: any) => challenge.title,
  requiresOtherPlayer: (challenge: any) => challenge.verification_type === 'other',
  setCurrentSelectedChallenge: (...args: any[]) => mockSetCurrentSelectedChallenge(...args),
  useBadgeProgress: () => ({
    approvedCompletions: [],
    approvedChallengeIds: new Set(),
    badgeAwards: [],
    pendingChallengeIds: new Set(),
    progressByCategory: new Map(),
    refresh: mockRefreshProgress,
    progressRows: [],
    error: false,
  }),
  useChallengeChoices: () => ({
    choices: mockChoices,
    error: false,
    isLoading: false,
    refresh: mockRefreshChoices,
  }),
}));

const otherChallenge = {
  id: 'challenge-other',
  code: 'OTHER',
  legacy_code: null,
  title_key: null,
  category: 'craft_player',
  title: 'Partner rally',
  description: null,
  verification_type: 'other',
  requires_proof: false,
};

const soloChallenge = {
  ...otherChallenge,
  id: 'challenge-solo',
  code: 'SOLO',
  title: 'Solo serve drill',
  verification_type: 'self',
};

describe('ChallengeScreen cooldown flows', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockChoices = [];
    mockCompleteSelfChallenge.mockResolvedValue({ data: null, error: null });
    mockRefreshProgress.mockResolvedValue(undefined);
    mockRefreshChoices.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('locks, forfeits, shows the bouncing-ball cooldown, then returns to challenge options', async () => {
    mockChoices = [otherChallenge];

    render(<ChallengeScreen hideTabBar />);

    fireEvent.press(screen.getByTestId('challenge-card-challenge-other'));
    expect(screen.getByText('Lock-in')).toBeTruthy();
    expect(screen.getByText('Create event')).toBeTruthy();

    fireEvent.press(screen.getByText('Lock-in'));
    expect(mockSetCurrentSelectedChallenge).toHaveBeenLastCalledWith(otherChallenge);
    expect(screen.getByText('Forfeit')).toBeTruthy();

    fireEvent.press(screen.getByText('Forfeit'));
    expect(mockSetCurrentSelectedChallenge).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('challenge-cooldown-panel')).toBeTruthy();
    expect(screen.getByText('Breathe.')).toBeTruthy();
    expect(screen.getByText('When the ball stops bouncing new options will appear.')).toBeTruthy();
    expect(screen.getByText('1:00')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('challenge-cooldown-panel')).toBeNull();
      expect(screen.getByTestId('challenge-card-challenge-other')).toBeTruthy();
    });
  });

  it('shows the same one-minute cooldown after solo challenge completion', async () => {
    mockChoices = [soloChallenge];

    render(<ChallengeScreen hideTabBar />);

    fireEvent.press(screen.getByTestId('challenge-card-challenge-solo'));
    fireEvent.press(screen.getByText('Complete'));

    await waitFor(() => {
      expect(mockCompleteSelfChallenge).toHaveBeenCalledWith('challenge-solo');
      expect(screen.getByTestId('challenge-cooldown-panel')).toBeTruthy();
      expect(screen.getByText('Or repeat one more time. When the ball stops bouncing new options will appear.')).toBeTruthy();
      expect(screen.getByText('1:00')).toBeTruthy();
    });
  });
});
