import React from 'react';
import { render } from '@testing-library/react-native';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

import {
  SkeletonBox,
  VenueCardSkeleton,
  EventCardSkeleton,
  ReviewCardSkeleton,
  FriendCardSkeleton,
  LeaderboardSkeleton,
  NotificationSkeleton,
  FavoriteCardSkeleton,
  ProfileSkeleton,
  SkeletonList,
} from '../SkeletonLoader';

const mockColors = {
  bg: '#fafaf8',
  bgAlt: '#ffffff',
  bgMuted: '#f4f4ef',
  bgMid: '#ecece4',
  text: '#111810',
  textMuted: '#4a4f47',
  textFaint: '#9ca39a',
  textOnPrimary: '#ffffff',
  border: '#e2e4de',
  borderLight: '#eceee8',
  primary: '#14532d',
  primaryMid: '#166534',
  primaryLight: '#22c55e',
  primaryDim: '#dcfce7',
  primaryPale: '#f0fdf4',
  accent: '#c2410c',
  accentBright: '#ea580c',
  blue: '#1e40af',
  bluePale: '#eff6ff',
  purple: '#7c3aed',
  purpleMid: '#a78bfa',
  purplePale: '#f3f0ff',
  purpleDim: '#e9e5ff',
  red: '#ef4444',
  redDeep: '#dc2626',
  redPale: '#fef2f2',
  amber: '#f59e0b',
  amberPale: '#fff7ed',
  amberDeep: '#ffedd5',
  overlay: 'rgba(10,20,10,0.33)',
  overlayLight: 'rgba(10,20,10,0.20)',
  overlayHeavy: 'rgba(0,0,0,0.53)',
  mapBg: '#d4e4d0',
  shadow: '#000000',
  white: '#ffffff',
  black: '#000000',
};

beforeEach(() => {
  mockUseTheme.mockReturnValue({ colors: mockColors });
});

describe('SkeletonBox', () => {
  it('renders with correct testID', () => {
    const { getAllByTestId } = render(<SkeletonBox width={100} height={20} />);
    expect(getAllByTestId('skeleton-box').length).toBe(1);
  });

  it('accepts percentage width', () => {
    const { getByTestId } = render(<SkeletonBox width="50%" height={14} />);
    expect(getByTestId('skeleton-box')).toBeTruthy();
  });
});

describe('VenueCardSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<VenueCardSkeleton />);
    expect(getByTestId('venue-card-skeleton')).toBeTruthy();
  });
});

describe('EventCardSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<EventCardSkeleton />);
    expect(getByTestId('event-card-skeleton')).toBeTruthy();
  });
});

describe('ReviewCardSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<ReviewCardSkeleton />);
    expect(getByTestId('review-card-skeleton')).toBeTruthy();
  });
});

describe('FriendCardSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<FriendCardSkeleton />);
    expect(getByTestId('friend-card-skeleton')).toBeTruthy();
  });
});

describe('LeaderboardSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<LeaderboardSkeleton />);
    expect(getByTestId('leaderboard-skeleton')).toBeTruthy();
  });
});

describe('NotificationSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<NotificationSkeleton />);
    expect(getByTestId('notification-skeleton')).toBeTruthy();
  });
});

describe('FavoriteCardSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<FavoriteCardSkeleton />);
    expect(getByTestId('favorite-card-skeleton')).toBeTruthy();
  });
});

describe('ProfileSkeleton', () => {
  it('renders', () => {
    const { getByTestId } = render(<ProfileSkeleton />);
    expect(getByTestId('profile-skeleton')).toBeTruthy();
  });
});

describe('SkeletonList', () => {
  it('renders the correct number of children', () => {
    const { getAllByTestId } = render(
      <SkeletonList count={5}>
        <VenueCardSkeleton />
      </SkeletonList>,
    );
    expect(getAllByTestId('venue-card-skeleton').length).toBe(5);
  });

  it('defaults to 3 items', () => {
    const { getAllByTestId } = render(
      <SkeletonList>
        <FriendCardSkeleton />
      </SkeletonList>,
    );
    expect(getAllByTestId('friend-card-skeleton').length).toBe(3);
  });
});
