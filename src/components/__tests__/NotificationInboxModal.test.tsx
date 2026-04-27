import React, { useEffect, useRef } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en' as const }),
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

const mockRefreshUnreadCount = jest.fn();
jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: 0,
    refreshUnreadCount: mockRefreshUnreadCount,
    clearAll: jest.fn(),
  }),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../SkeletonLoader', () => ({
  NotificationSkeleton: () => null,
  SkeletonList: ({ children }: any) => children,
}));

jest.mock('../EmptyState', () => ({
  EmptyState: () => null,
}));

jest.mock('../SwipeableDeleteRow', () => ({
  SwipeableDeleteRow: ({ children }: any) => children,
}));

jest.mock('../../lib/haptics', () => ({
  hapticMedium: jest.fn(),
}));

const mockGetNotifications = jest.fn();
const mockMarkAsRead = jest.fn();
jest.mock('../../services/notifications', () => ({
  getNotifications: (...args: any[]) => mockGetNotifications(...args),
  markAsRead: (...args: any[]) => mockMarkAsRead(...args),
  markAllAsRead: jest.fn().mockResolvedValue({ error: null }),
  deleteNotification: jest.fn().mockResolvedValue({ error: null }),
  deleteAllNotifications: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('../../services/friends', () => ({
  acceptRequest: jest.fn().mockResolvedValue({ error: null }),
  declineRequest: jest.fn().mockResolvedValue({ error: null }),
  getPendingRequests: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../lib/supabase', () => {
  const channel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };
  return {
    supabase: {
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(),
    },
  };
});

import { NotificationInboxModal, type NotificationInboxModalRef } from '../NotificationInboxModal';

function Harness() {
  const ref = useRef<NotificationInboxModalRef>(null);
  useEffect(() => {
    ref.current?.present();
  }, []);
  return <NotificationInboxModal ref={ref} />;
}

describe('NotificationInboxModal — handleTap deep linking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      user: { id: 'u-1' },
      session: { user: { id: 'u-1' } },
    });
    mockMarkAsRead.mockResolvedValue({ error: null });
  });

  async function renderWithNotification(notification: any) {
    mockGetNotifications.mockResolvedValue({ data: [notification], error: null });
    const utils = render(<Harness />);
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalled());
    return utils;
  }

  it('forwards eventId as ?eventId= when route has no query', async () => {
    const { findByText } = await renderWithNotification({
      id: 1,
      type: 'event_feedback_received',
      title: 'New feedback',
      body: 'Maria left feedback',
      read: false,
      created_at: new Date().toISOString(),
      data: { screen: '/(tabs)/events', eventId: 42 },
    });

    fireEvent.press(await findByText('New feedback'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/events?eventId=42');
    });
  });

  it('routes event_feedback_request to the dedicated feedback route', async () => {
    const { findByText } = await renderWithNotification({
      id: 2,
      type: 'event_feedback_request',
      title: 'How was it?',
      body: 'Leave feedback for the event',
      read: false,
      created_at: new Date().toISOString(),
      data: { screen: '/(protected)/event-feedback/7', eventId: 7 },
    });

    fireEvent.press(await findByText('How was it?'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(protected)/event-feedback/7?eventId=7');
    });
  });

  it('does not append eventId when notification has no eventId in data', async () => {
    const { findByText } = await renderWithNotification({
      id: 3,
      type: 'friend_accepted',
      title: 'Friend accepted',
      body: 'You are now friends',
      read: false,
      created_at: new Date().toISOString(),
      data: { screen: '/(protected)/friends' },
    });

    fireEvent.press(await findByText('Friend accepted'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(protected)/friends');
    });
  });

  it('falls back to /(tabs) when route prefix is not allowed', async () => {
    const { findByText } = await renderWithNotification({
      id: 4,
      type: 'event_feedback_received',
      title: 'Bad route',
      body: 'External link attempt',
      read: false,
      created_at: new Date().toISOString(),
      data: { screen: 'https://evil.example.com/steal', eventId: 5 },
    });

    fireEvent.press(await findByText('Bad route'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(tabs)?eventId=5');
    });
  });

  it('marks notification as read on tap', async () => {
    const { findByText } = await renderWithNotification({
      id: 9,
      type: 'event_feedback_received',
      title: 'Tap me',
      body: 'body',
      read: false,
      created_at: new Date().toISOString(),
      data: { screen: '/(tabs)/events', eventId: 1 },
    });

    fireEvent.press(await findByText('Tap me'));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith(9, 'u-1');
    });
  });
});
