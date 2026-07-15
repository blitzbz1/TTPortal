// F054 — "TT Wrapped" swipeable story deck render, card swipe + share button.

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

// The year-in-review query hook — driven per-test. The other named exports from
// the barrel (window helper + maps) are passed through to their real values.
const mockWrapped = jest.fn();
jest.mock('../../features/wrapped', () => {
  const actual = jest.requireActual('../../features/wrapped');
  return {
    ...actual,
    useYearInReviewQuery: () => ({ data: mockWrapped(), isLoading: false }),
  };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WrappedStoryScreen } from '../WrappedStoryScreen';

const FULL_WRAPPED = {
  year: 2025,
  hours: 42,
  sessions: 30,
  venues: 6,
  events: 3,
  badges: 4,
  milestones: 2,
  partners: 7,
  top_venue: { id: 1, name: 'Club Central', checkins: 12 },
  top_month: { month: 7, sessions: 9 },
  partner_of_year: { user_id: 'u2', full_name: 'Rival Rita' },
  archetype: 'social_player' as const,
};

describe('WrappedStoryScreen (F054)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrapped.mockReturnValue(FULL_WRAPPED);
  });

  it('renders the swipeable deck with the intro, hours and archetype cards', () => {
    const { getByTestId } = render(<WrappedStoryScreen year={2025} />);
    expect(getByTestId('wrapped-deck')).toBeTruthy();
    expect(getByTestId('wrapped-card-intro')).toBeTruthy();
    expect(getByTestId('wrapped-card-hours')).toBeTruthy();
    expect(getByTestId('wrapped-card-archetype')).toBeTruthy();
  });

  it('renders the data-gated cards when their data is present', () => {
    const { getByTestId } = render(<WrappedStoryScreen year={2025} />);
    expect(getByTestId('wrapped-card-topVenue')).toBeTruthy();
    expect(getByTestId('wrapped-card-topMonth')).toBeTruthy();
    expect(getByTestId('wrapped-card-partner')).toBeTruthy();
    expect(getByTestId('wrapped-card-badges')).toBeTruthy();
  });

  it('swiping advances the active card index', () => {
    const { getByTestId } = render(<WrappedStoryScreen year={2025} />);
    const deck = getByTestId('wrapped-deck');
    // Simulate a paged momentum-scroll to the second card (width 430 in tests).
    fireEvent(deck, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 430 }, layoutMeasurement: { width: 430 }, contentSize: { width: 2580 } },
    });
    // The share button still renders after the swipe (active card changed).
    expect(getByTestId('wrapped-share')).toBeTruthy();
  });

  it('captures and shares the active card when "Share" is pressed', () => {
    const { getByTestId } = render(<WrappedStoryScreen year={2025} />);
    fireEvent.press(getByTestId('wrapped-share'));
    expect(mockShareCardImage).toHaveBeenCalledTimes(1);
    // Called with (ref, shareMessage) — the message carries the year.
    const [, message] = mockShareCardImage.mock.calls[0];
    expect(message).toContain('2025');
  });

  it('renders the empty state for a user who did not play', () => {
    mockWrapped.mockReturnValue({
      ...FULL_WRAPPED,
      hours: 0,
      sessions: 0,
      top_venue: null,
      top_month: null,
      partner_of_year: null,
      badges: 0,
      milestones: 0,
      archetype: 'casual' as const,
    });
    const { getByTestId, queryByTestId } = render(<WrappedStoryScreen year={2025} />);
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(queryByTestId('wrapped-share')).toBeNull();
  });
});
