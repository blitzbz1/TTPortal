import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { useNotifications } from '../hooks/useNotifications';
import { useI18n } from '../hooks/useI18n';
import { getNotifications, markAsRead } from '../services/notifications';

const ICON_MAP: Record<string, { name: string; color: string; bg: string }> = {
  friend_request: { name: 'user-plus', color: Colors.purple, bg: Colors.purplePale },
  friend_accepted: { name: 'user-check', color: Colors.greenMid, bg: Colors.greenPale },
  event_reminder: { name: 'calendar-clock', color: Colors.orange, bg: Colors.amberPale },
  event_joined: { name: 'calendar-plus', color: Colors.greenMid, bg: Colors.greenPale },
  event_cancelled: { name: 'calendar-x', color: Colors.red, bg: Colors.redPale },
  checkin_nearby: { name: 'map-pin', color: Colors.blue, bg: Colors.bluePale },
  review_on_venue: { name: 'star', color: Colors.orange, bg: Colors.amberPale },
};

export function NotificationsScreen() {
  const { user } = useSession();
  const { refreshUnreadCount, clearAll } = useNotifications();
  const { s } = useI18n();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getNotifications(user.id);
    if (data) setNotifications(data);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleTap = useCallback(async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      refreshUnreadCount();
    }
    const data = notification.data;
    if (data?.screen) {
      router.push(data.screen as any);
    }
  }, [router, refreshUnreadCount]);

  const handleClearAll = useCallback(async () => {
    await clearAll();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [clearAll]);

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return s('justNow');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('notifications')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearText}>{s('markAllRead')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.green} style={{ flex: 1, marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Lucide name="bell-off" size={48} color={Colors.inkFaint} />
          <Text style={styles.emptyText}>{s('noNotifications')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          {notifications.map((n) => {
            const icon = ICON_MAP[n.type] || ICON_MAP.friend_request;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.read && styles.cardUnread]}
                onPress={() => handleTap(n)}
              >
                <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                  <Lucide name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, !n.read && styles.cardTitleUnread]}>
                    {n.title}
                  </Text>
                  <Text style={styles.cardBody}>{n.body}</Text>
                  <Text style={styles.cardTime}>{formatTime(n.created_at)}</Text>
                </View>
                {!n.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ink,
  },
  clearText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.greenMid,
  },
  scroll: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cardUnread: {
    backgroundColor: Colors.greenPale,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.ink,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  cardBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkMuted,
  },
  cardTime: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.greenLight,
  },
});
