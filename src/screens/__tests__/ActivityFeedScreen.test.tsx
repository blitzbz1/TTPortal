import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ActivityFeedScreen } from '../ActivityFeedScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
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

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../components/Card', () => ({
  Card: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('../../components/EmptyState', () => ({
  EmptyState: ({ title, ctaLabel, onCtaPress }: any) => {
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <>
        <Text testID="empty-state-title">{title}</Text>
        {ctaLabel && (
          <TouchableOpacity testID="empty-state-cta" onPress={onCtaPress}>
            <Text>{ctaLabel}</Text>
          </TouchableOpacity>
        )}
      </>
    );
  },
}));

jest.mock('../../components/SkeletonLoader', () => ({
  NotificationSkeleton: () => null,
  SkeletonList: ({ children }: any) => children,
}));

const mockGetFriendFeed = jest.fn();
jest.mock('../../services/feed', () => ({
  getFriendFeed: (...args: any[]) => mockGetFriendFeed(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockS.mockImplementation((key: string) => key);
  mockGetFriendFeed.mockResolvedValue({ data: [], error: null });
});

describe('ActivityFeedScreen', () => {
  it('shows login prompt when not authenticated', () => {
    mockUseSession.mockReturnValue({ user: null });
    const { getAllByText } = render(<ActivityFeedScreen />);
    expect(getAllByText('authLogin').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when authenticated but no feed items', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'u1' } });
    mockGetFriendFeed.mockResolvedValue({ data: [], error: null });

    const { findByTestId } = render(<ActivityFeedScreen />);
    const emptyTitle = await findByTestId('empty-state-title');
    expect(emptyTitle).toBeTruthy();
  });

  it('renders feed items when data exists', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'u1' } });
    mockGetFriendFeed.mockResolvedValue({
      data: [
        {
          id: 'checkin-1',
          type: 'checkin',
          userId: 'f1',
          userName: 'Andrei',
          venueName: 'ClubPing',
          venueId: 42,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'review-1',
          type: 'review',
          userId: 'f1',
          userName: 'Maria',
          venueName: 'Parc Tineretului',
          venueId: 7,
          rating: 5,
          timestamp: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const { findByTestId, getByText } = render(<ActivityFeedScreen />);
    expect(await findByTestId('feed-item-checkin-1')).toBeTruthy();
    expect(await findByTestId('feed-item-review-1')).toBeTruthy();
    expect(getByText('Andrei')).toBeTruthy();
    expect(getByText('ClubPing')).toBeTruthy();
  });

  it('renders a moment feed item with its photo and verb (F042)', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'u1' } });
    mockGetFriendFeed.mockResolvedValue({
      data: [
        {
          id: 'moment-3',
          type: 'moment',
          userId: 'f2',
          userName: 'Ioana',
          venueName: 'ClubPing',
          venueId: 42,
          photoUrl: 'https://cdn/moments/f2/9.jpg',
          timestamp: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const { findByTestId, getByText } = render(<ActivityFeedScreen />);
    expect(await findByTestId('feed-item-moment-3')).toBeTruthy();
    // The moment branch renders a photo card (camera icon variant) + author.
    expect(await findByTestId('feed-moment-photo-moment-3')).toBeTruthy();
    expect(getByText('Ioana')).toBeTruthy();
  });

  it('navigates to venue when feed item is tapped', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'u1' } });
    mockGetFriendFeed.mockResolvedValue({
      data: [
        {
          id: 'checkin-1',
          type: 'checkin',
          userId: 'f1',
          userName: 'Test',
          venueName: 'Test Venue',
          venueId: 99,
          timestamp: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const { findByTestId } = render(<ActivityFeedScreen />);
    const card = await findByTestId('feed-item-checkin-1');
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/venue/[id]', params: { id: '99' } });
  });
});
