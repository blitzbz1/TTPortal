import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { NotificationProvider } from '../NotificationProvider';
import { OfflineQueueProvider } from '../OfflineQueueProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() }),
}));

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../../services/notifications', () => ({
  getNotifications: jest.fn(() => Promise.resolve({ data: [] })),
  markAsRead: jest.fn(() => Promise.resolve({})),
  markAllAsRead: jest.fn(() => Promise.resolve({})),
  deleteNotification: jest.fn(() => Promise.resolve({})),
  deleteAllNotifications: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../services/pushTokens', () => ({
  upsertPushToken: jest.fn(() => Promise.resolve()),
  deletePushToken: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../lib/notifications', () => ({
  registerForPushNotificationsAsync: jest.fn(() => Promise.resolve(null)),
  getDeviceType: jest.fn(() => 'phone'),
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

const addResponseListener =
  Notifications.addNotificationResponseReceivedListener as jest.Mock;
const getLastResponse = Notifications.getLastNotificationResponseAsync as jest.Mock;

function makeResponse(data: Record<string, unknown>) {
  return { notification: { request: { content: { data } } } };
}

function renderProvider() {
  return render(
    <OfflineQueueProvider>
      <NotificationProvider>{null}</NotificationProvider>
    </OfflineQueueProvider>,
  );
}

describe('NotificationProvider push-tap routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ user: null });
    getLastResponse.mockResolvedValue(null);
  });

  it('routes warm push taps including the eventId param', async () => {
    renderProvider();
    await act(async () => {});

    const listener = addResponseListener.mock.calls[0][0];
    act(() => {
      listener(makeResponse({ screen: '/(protected)/events', eventId: 42 }));
    });

    expect(mockPush).toHaveBeenCalledWith('/(protected)/events?eventId=42');
  });

  it('routes warm push taps with snake_case event_id (migration 012)', async () => {
    renderProvider();
    await act(async () => {});

    const listener = addResponseListener.mock.calls[0][0];
    act(() => {
      listener(makeResponse({ screen: '/(protected)/events', event_id: 9 }));
    });

    expect(mockPush).toHaveBeenCalledWith('/(protected)/events?eventId=9');
  });

  it('routes the cold-start tap from getLastNotificationResponseAsync', async () => {
    getLastResponse.mockResolvedValue(
      makeResponse({ screen: '/(protected)/events', eventId: 7 }),
    );

    renderProvider();

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/(protected)/events?eventId=7'),
    );
    expect(getLastResponse).toHaveBeenCalledTimes(1);
  });

  it('does not navigate on cold start without a stored response', async () => {
    renderProvider();
    await act(async () => {});

    expect(getLastResponse).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
