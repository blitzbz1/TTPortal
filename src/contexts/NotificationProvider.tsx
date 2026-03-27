import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { registerForPushNotificationsAsync, getDeviceType } from '../lib/notifications';
import { upsertPushToken, deletePushToken } from '../services/pushTokens';
import { getUnreadCount, markAllAsRead } from '../services/notifications';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  clearAll: () => Promise<void>;
  pushToken: string | null;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

interface Props {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: Props) {
  const { user } = useSession();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const { data } = await getUnreadCount(user.id);
    setUnreadCount(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    setUnreadCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Register/unregister push token on user change
  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (currentUserId && currentUserId !== prevUserIdRef.current) {
      // User signed in — register token
      (async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token && user) {
            setPushToken(token);
            await upsertPushToken(user.id, token, getDeviceType());
            logger.info('Push token registered', { userId: user.id });
          }
        } catch (err) {
          logger.warn('Push token registration failed', err as Record<string, unknown>);
        }
      })();
      refreshUnreadCount();
    }

    if (!currentUserId && prevUserIdRef.current && pushToken) {
      // User signed out — remove token
      (async () => {
        try {
          await deletePushToken(prevUserIdRef.current!, pushToken);
          setPushToken(null);
          setUnreadCount(0);
          logger.info('Push token removed on sign-out');
        } catch (err) {
          logger.warn('Push token removal failed', err as Record<string, unknown>);
        }
      })();
    }

    prevUserIdRef.current = currentUserId;
  }, [user, pushToken, refreshUnreadCount]);

  // Set up notification listeners
  useEffect(() => {
    try {
      // Foreground notification received — refresh count
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        refreshUnreadCount();
      });

      // User tapped a notification — navigate
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.screen) {
          router.push(data.screen as any);
        }
        refreshUnreadCount();
      });
    } catch {
      logger.warn('Notification listeners not available (Expo Go)');
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router, refreshUnreadCount]);

  // Supabase Realtime: instant updates when new notifications arrive
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          refreshUnreadCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshUnreadCount]);

  // Fallback poll every 60s in case realtime misses something
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  const value = React.useMemo<NotificationContextValue>(
    () => ({ unreadCount, refreshUnreadCount, clearAll, pushToken }),
    [unreadCount, refreshUnreadCount, clearAll, pushToken],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
