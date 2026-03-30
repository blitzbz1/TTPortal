import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Animated, PanResponder, Platform, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { useNotifications } from '../hooks/useNotifications';
import { useI18n } from '../hooks/useI18n';
import { getNotifications, markAsRead, deleteNotification, deleteAllNotifications } from '../services/notifications';
import { acceptRequest, declineRequest, getPendingRequests } from '../services/friends';

function getIconMap(colors: ThemeColors): Record<string, { name: string; color: string; bg: string }> {
  return {
    friend_request: { name: 'user-plus', color: colors.purple, bg: colors.purplePale },
    friend_accepted: { name: 'user-check', color: colors.primaryMid, bg: colors.primaryPale },
    event_reminder: { name: 'calendar-clock', color: colors.accent, bg: colors.amberPale },
    event_joined: { name: 'calendar-plus', color: colors.primaryMid, bg: colors.primaryPale },
    event_cancelled: { name: 'calendar-x', color: colors.red, bg: colors.redPale },
    checkin_nearby: { name: 'map-pin', color: colors.blue, bg: colors.bluePale },
    review_on_venue: { name: 'star', color: colors.accent, bg: colors.amberPale },
    event_invite: { name: 'mail', color: colors.purple, bg: colors.purplePale },
    event_update: { name: 'megaphone', color: colors.accent, bg: colors.amberPale },
  };
}

const DELETE_THRESHOLD = -80;

function SwipeableRow({ children, onDelete, colors }: { children: React.ReactNode; onDelete: () => void; colors: ThemeColors }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const sw = useMemo(() => createSwStyles(colors), [colors]);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < DELETE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -300, duration: 200, useNativeDriver: true }).start(onDelete);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={sw.container}>
      <View style={sw.deleteBackground}>
        <Lucide name="trash-2" size={18} color={colors.textOnPrimary} />
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export function NotificationsScreen() {
  const { user } = useSession();
  const { refreshUnreadCount, clearAll } = useNotifications();
  const { s } = useI18n();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingMap, setPendingMap] = useState<Map<string, number>>(new Map()); // sender_id → friendship id
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ICON_MAP = useMemo(() => getIconMap(colors), [colors]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [notifRes, pendingRes] = await Promise.all([
      getNotifications(user.id),
      getPendingRequests(user.id),
    ]);
    if (notifRes.data) setNotifications(notifRes.data);
    // Map sender_id → friendship id for inline accept/decline
    if (pendingRes.data) {
      const map = new Map<string, number>();
      for (const p of pendingRes.data) {
        map.set(p.requester_id, p.id);
      }
      setPendingMap(map);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

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

  const handleDelete = useCallback(async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  const handleDeleteAll = useCallback(async () => {
    if (!user) return;
    const doDelete = async () => {
      setNotifications([]);
      await deleteAllNotifications(user.id);
      refreshUnreadCount();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(s('deleteAllConfirm'))) await doDelete();
    } else {
      Alert.alert(s('deleteAllNotifications'), s('deleteAllConfirm'), [
        { text: s('cancel'), style: 'cancel' },
        { text: s('deleteNotification'), style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [user, refreshUnreadCount]);

  const handleAcceptFriend = useCallback(async (senderId: string, notifId: number) => {
    const friendshipId = pendingMap.get(senderId);
    if (!friendshipId) return;
    const { error } = await acceptRequest(friendshipId);
    if (error) return;
    setRespondedIds((prev) => new Set(prev).add(senderId));
    // Mark notification as read
    await markAsRead(notifId);
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, read: true } : n));
    refreshUnreadCount();
  }, [pendingMap, refreshUnreadCount]);

  const handleDeclineFriend = useCallback(async (senderId: string, notifId: number) => {
    const friendshipId = pendingMap.get(senderId);
    if (!friendshipId) return;
    const { error } = await declineRequest(friendshipId);
    if (error) return;
    setRespondedIds((prev) => new Set(prev).add(senderId));
    await markAsRead(notifId);
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, read: true } : n));
    refreshUnreadCount();
  }, [pendingMap, refreshUnreadCount]);

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
          <Lucide name="arrow-left" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('notifications')}</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={styles.actionText}>{s('markAllRead')}</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleDeleteAll}>
              <Lucide name="trash-2" size={18} color={colors.textOnPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Lucide name="bell-off" size={48} color={colors.textFaint} />
          <Text style={styles.emptyText}>{s('noNotifications')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
          {notifications.map((n) => {
            const icon = ICON_MAP[n.type] || ICON_MAP.friend_request;
            return (
              <SwipeableRow key={n.id} onDelete={() => handleDelete(n.id)} colors={colors}>
                <TouchableOpacity
                  style={[styles.card, !n.read && styles.cardUnread]}
                  onPress={() => handleTap(n)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                    <Lucide name={icon.name} size={20} color={icon.color} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, !n.read && styles.cardTitleUnread]}>
                      {n.title}
                    </Text>
                    <Text style={styles.cardBody}>{n.body}</Text>
                    {/* Inline Accept/Decline for friend requests */}
                    {n.type === 'friend_request' && n.sender_id && pendingMap.has(n.sender_id) && !respondedIds.has(n.sender_id) && (
                      <View style={styles.inlineActions}>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptFriend(n.sender_id, n.id)}>
                          <Lucide name="check" size={14} color={colors.textOnPrimary} />
                          <Text style={styles.acceptBtnText}>{s('accept')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineBtn} onPress={() => handleDeclineFriend(n.sender_id, n.id)}>
                          <Lucide name="x" size={14} color={colors.red} />
                          <Text style={styles.declineBtnText}>{s('decline')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {n.type === 'friend_request' && respondedIds.has(n.sender_id) && (
                      <Text style={styles.respondedText}>{s('accepted')}</Text>
                    )}
                    <Text style={styles.cardTime}>{formatTime(n.created_at)}</Text>
                  </View>
                  {!n.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              </SwipeableRow>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createSwStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      position: 'relative',
      overflow: 'hidden',
    },
    deleteBackground: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 80,
      backgroundColor: colors.red,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      minHeight: 52,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    actionText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textOnPrimary,
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
      color: colors.textFaint,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      paddingHorizontal: 16,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.bg,
    },
    cardUnread: {
      backgroundColor: colors.primaryPale,
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
      color: colors.text,
    },
    cardTitleUnread: {
      fontWeight: '700',
    },
    cardBody: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textMuted,
    },
    cardTime: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
    },
    inlineActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 6,
    },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 12,
      gap: 4,
    },
    acceptBtnText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    declineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 12,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    declineBtnText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '500',
      color: colors.red,
    },
    respondedText: {
      fontFamily: Fonts.body,
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryMid,
      marginTop: 4,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primaryLight,
    },
  });
}
