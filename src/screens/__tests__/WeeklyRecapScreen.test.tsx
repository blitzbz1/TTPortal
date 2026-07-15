// F052 — "Your week in TT" recap screen render + share button.

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
    s: (key: string, ...args: unknown[]) => {
      const raw = require('../../locales/en.json')[key] || key;
      return args.reduce<string>(
        (acc, arg, i) => acc.replace(`{${i}}`, String(arg)),
        raw,
      );
    },
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
jest.mock('../../components/Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({ name }: { name: string }) => <View testID={`lucide-icon-${name}`} />,
  };
});

// The capture+share helper is the assertion target for the share button.
const mockShareCardImage = jest.fn();
jest.mock('../../lib/shareImage', () => ({
  shareCardImage: (...args: unknown[]) => mockShareCardImage(...args),
}));

// The recap query hook — driven per-test.
const mockRecap = jest.fn();
jest.mock('../../features/recap', () => ({
  useWeeklyRecapQuery: () => ({ data: mockRecap(), isLoading: false }),
  lastWeekStartIso: () => '2026-06-08',
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WeeklyRecapScreen } from '../WeeklyRecapScreen';

const FULL_RECAP = {
  sessions: 4,
  hours: 6,
  venues: 3,
  new_venues: 2,
  friends_played_with: 2,
  rank: 5,
  rank_delta: 3,
  current_streak: 6,
};

describe('WeeklyRecapScreen (F052)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecap.mockReturnValue(FULL_RECAP);
  });

  it('renders the recap stats when the user played', () => {
    const { getByTestId } = render(<WeeklyRecapScreen />);
    expect(getByTestId('recap-stat-sessions')).toBeTruthy();
    expect(getByTestId('recap-stat-hours')).toBeTruthy();
    expect(getByTestId('recap-stat-venues')).toBeTruthy();
    expect(getByTestId('recap-stat-friends')).toBeTruthy();
  });

  it('shows the new-venue callout, rank and streak when present', () => {
    const { getByTestId } = render(<WeeklyRecapScreen />);
    expect(getByTestId('recap-new-venues')).toBeTruthy();
    expect(getByTestId('recap-rank')).toBeTruthy();
    expect(getByTestId('recap-rank-delta')).toBeTruthy();
    expect(getByTestId('recap-streak')).toBeTruthy();
  });

  it('captures and shares the card when "Share my week" is pressed', () => {
    const { getByTestId } = render(<WeeklyRecapScreen />);
    fireEvent.press(getByTestId('recap-share'));
    expect(mockShareCardImage).toHaveBeenCalledTimes(1);
    // Called with (ref, shareMessage).
    const [, message] = mockShareCardImage.mock.calls[0];
    expect(message).toBe(require('../../locales/en.json').recapShareMessage);
  });

  it('renders the empty state for a user who did not play', () => {
    mockRecap.mockReturnValue({
      sessions: 0,
      hours: 0,
      venues: 0,
      new_venues: 0,
      friends_played_with: 0,
      rank: null,
      rank_delta: null,
      current_streak: 0,
    });
    const { getByTestId, queryByTestId } = render(<WeeklyRecapScreen />);
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(queryByTestId('recap-share')).toBeNull();
  });
});
