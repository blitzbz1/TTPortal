import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { registerForPushNotificationsAsync, getDeviceType } from '../lib/notifications';
import { upsertPushToken, deletePushToken } from '../services/pushTokens';
import {
  getNotifications,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
  deleteAllNotifications as deleteAllNotificationsService,
} from '../services/notifications';
import { useRealtime } from '../hooks/useRealtime';
import { logger } from '../lib/logger';
import { sanitizeRoute } from '../lib/auth-utils';
import { withOptimistic } from '../lib/optimistic';

export const PAGE_SIZE = 20;

export interface NotificationRecord {
  id: number;
  recipient_id: string;
  sender_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export interface NotificationContextValue {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  deleteAll: () => Promise<void>;
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
  const userId = user?.id;
  const [pushToken, setPushToken] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const initialLoadDone = useRef(false);
  const notificationsRef = useRef<NotificationRecord[]>([]);
  notificationsRef.current = notifications;

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [notifications],
  );

  const fetchPage = useCallback(
    async (offset: number, isRefresh: boolean) => {
      if (!userId) return;
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const { data } = await getNotifications(userId, PAGE_SIZE, offset);
        const rows = (data ?? []) as NotificationRecord[];
        setHasMore(rows.length === PAGE_SIZE);
        if (isRefresh || offset === 0) {
          setNotifications(rows);
        } else {
          setNotifications((prev) => {
            const seen = new Set(prev.map((n) => n.id));
            const merged = [...prev];
            for (const r of rows) if (!seen.has(r.id)) merged.push(r);
            return merged;
          });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    await fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (isLoading || isRefreshing || !hasMore) return;
    await fetchPage(notificationsRef.current.length, false);
  }, [fetchPage, isLoading, isRefreshing, hasMore]);

  const markAsRead = useCallback(
    async (id: number) => {
      if (!userId) return;
      await withOptimistic({
        setState: setNotifications,
        current: notificationsRef.current,
        next: (prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        mutate: () => markAsReadService(id, userId),
      });
    },
    [userId],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await withOptimistic({
      setState: setNotifications,
      current: notificationsRef.current,
      next: (prev) => prev.map((n) => ({ ...n, read: true })),
      mutate: () => markAllAsReadService(userId),
    });
  }, [userId]);

  const deleteNotification = useCallback(
    async (id: number) => {
      if (!userId) return;
      await withOptimistic({
        setState: setNotifications,
        current: notificationsRef.current,
        next: (prev) => prev.filter((n) => n.id !== id),
        mutate: () => deleteNotificationService(id, userId),
      });
    },
    [userId],
  );

  const deleteAll = useCallback(async () => {
    if (!userId) return;
    await withOptimistic({
      setState: setNotifications,
      current: notificationsRef.current,
      next: [],
      mutate: () => deleteAllNotificationsService(userId),
    });
    setHasMore(false);
  }, [userId]);

  useRealtime({
    channelName: `notifications-${userId ?? 'anon'}`,
    table: 'notifications',
    filter: userId ? `recipient_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onInsert: useCallback((payload: any) => {
      const row = payload.new as NotificationRecord;
      if (notificationsRef.current.some((n) => n.id === row.id)) return;
      setNotifications((prev) => [row, ...prev]);
    }, []),
    onUpdate: useCallback((payload: any) => {
      const row = payload.new as NotificationRecord;
      setNotifications((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
    }, []),
    onDelete: useCallback((payload: any) => {
      const oldRow = payload.old as { id?: number };
      if (oldRow.id == null) return;
      setNotifications((prev) => prev.filter((n) => n.id !== oldRow.id));
    }, []),
    onReconnect: refresh,
  });

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setHasMore(true);
      initialLoadDone.current = false;
      return;
    }
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchPage(0, false);
    }
  }, [userId, fetchPage]);

  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (currentUserId && currentUserId !== prevUserIdRef.current) {
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
    }

    if (!currentUserId && prevUserIdRef.current && pushToken) {
      (async () => {
        try {
          await deletePushToken(prevUserIdRef.current!, pushToken);
          setPushToken(null);
          logger.info('Push token removed on sign-out');
        } catch (err) {
          logger.warn('Push token removal failed', err as Record<string, unknown>);
        }
      })();
    }

    prevUserIdRef.current = currentUserId;
  }, [user, pushToken]);

  useEffect(() => {
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        void refresh();
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.screen) {
          const safeRoute = sanitizeRoute(data.screen as string);
          router.push(safeRoute as any);
        }
      });
    } catch {
      logger.warn('Notification listeners not available (Expo Go)');
    }

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [router, refresh]);

  const refreshUnreadCount = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const clearAll = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      isRefreshing,
      hasMore,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAll,
      refreshUnreadCount,
      clearAll,
      pushToken,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      isRefreshing,
      hasMore,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAll,
      refreshUnreadCount,
      clearAll,
      pushToken,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
