import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from './useSession';
import { useNotifications } from './useNotifications';
import {
  getNotifications,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
  deleteAllNotifications as deleteAllNotificationsService,
} from '../services/notifications';

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

export interface UseNotificationHistoryReturn {
  notifications: NotificationRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  deleteAll: () => Promise<void>;
}

export function useNotificationHistory(): UseNotificationHistoryReturn {
  const { user } = useSession();
  const userId = user?.id;
  const { refreshUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const initialLoadDone = useRef(false);
  const notificationsRef = useRef<NotificationRecord[]>([]);
  notificationsRef.current = notifications;

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
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      await markAsReadService(id, userId);
      refreshUnreadCount();
    },
    [userId, refreshUnreadCount],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllAsReadService(userId);
    refreshUnreadCount();
  }, [userId, refreshUnreadCount]);

  const deleteNotification = useCallback(
    async (id: number) => {
      if (!userId) return;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await deleteNotificationService(id, userId);
      refreshUnreadCount();
    },
    [userId, refreshUnreadCount],
  );

  const deleteAll = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    setHasMore(false);
    await deleteAllNotificationsService(userId);
    refreshUnreadCount();
  }, [userId, refreshUnreadCount]);

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
    if (!userId) return;
    const channel = supabase
      .channel(`notification-history-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRecord;
          if (notificationsRef.current.some((n) => n.id === row.id)) return;
          setNotifications((prev) => [row, ...prev]);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRecord;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const oldRow = payload.old as { id?: number };
          if (oldRow.id == null) return;
          setNotifications((prev) => prev.filter((n) => n.id !== oldRow.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return useMemo(
    () => ({
      notifications,
      isLoading,
      isRefreshing,
      hasMore,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAll,
    }),
    [
      notifications,
      isLoading,
      isRefreshing,
      hasMore,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAll,
    ],
  );
}
