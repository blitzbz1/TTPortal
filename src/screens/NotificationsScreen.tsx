import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Platform, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { hapticMedium } from '../lib/haptics';
import { Duration, Springs } from '../lib/motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useNotifications } from '../hooks/useNotifications';
import { useI18n } from '../hooks/useI18n';
import { getNotifications, markAsRead, deleteNotification, deleteAllNotifications } from '../services/notifications';
import { acceptRequest, declineRequest, getPendingRequests } from '../services/friends';
import { sanitizeRoute } from '../lib/auth-utils';
import { NotificationSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';

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
    event_feedback_request: { name: 'message-square', color: colors.primaryMid, bg: colors.primaryPale },
    event_feedback_received: { name: 'star', color: colors.accent, bg: colors.amberPale },
    feedback_reply: { name: 'message-circle', color: colors.primaryMid, bg: colors.primaryPale },
  };
}

const DELETE_THRESHOLD = -80;

function SwipeableRow({ children, onDelete, colors }: { children: React.ReactNode; onDelete: () => void; colors: ThemeColors }) {
  const translateX = useSharedValue(0);
  // scaleY runs on the UI thread (native driver-safe). We avoid animating
  // `height` because that would force a layout pass per frame on the JS
  // thread. The row is unmounted by `onDelete` once scaleY reaches 0.
  const rowScaleY = useSharedValue(1);
  const rowOpacity = useSharedValue(1);
  const sw = useMemo(() => createSwStyles(colors), [colors]);
  const [swiping, setSwiping] = useState(false);
  const hapticFired = useRef(false);

  const panResponderRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => { setSwiping(true); hapticFired.current = false; },
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) {
          translateX.value = g.dx;
          if (g.dx < DELETE_THRESHOLD && !hapticFired.current) {
            hapticFired.current = true;
            hapticMedium();
          }
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < DELETE_THRESHOLD) {
          translateX.value = withTiming(-400, { duration: Duration.fast }, () => {
            rowScaleY.value = withTiming(0, { duration: Duration.base });
            rowOpacity.value = withTiming(0, { duration: Duration.fast }, () => {
              runOnJS(onDelete)();
            });
          });
        } else {
          translateX.value = withSpring(0, Springs.snappy);
          setSwiping(false);
        }
      },
    }),
  ).current;

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: rowScaleY.value }],
    opacity: rowOpacity.value,
    overflow: 'hidden' as const,
  }));

  return (
    <Animated.View style={containerStyle}>
      <View style={sw.container}>
        {swiping && (
          <View style={sw.deleteBackground}>
            <Lucide name="trash-2" size={18} color={colors.textOnPrimary} />
          </View>
        )}
        <Animated.View style={slideStyle} {...panResponderRef.panHandlers}>
          {children}
        </Animated.View>
      </View>
    </Animated.View>
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
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
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
      await markAsRead(notification.id, user!.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      refreshUnreadCount();
    }
    const data = notification.data;
    if (data?.screen) {
      const safeRoute = sanitizeRoute(data.screen);
      // Forward eventId as a query param so the destination screen can deep-link
      // into the specific event (e.g. opening the event detail sheet).
      const withParams = data.eventId != null && !safeRoute.includes('?')
        ? `${safeRoute}?eventId=${data.eventId}`
        : safeRoute;
      router.push(withParams as any);
    }
  }, [router, refreshUnreadCount, user]);

  const handleDelete = useCallback(async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id, user!.id);
    refreshUnreadCount();
  }, [refreshUnreadCount, user]);

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
  }, [user, refreshUnreadCount, s]);

  const handleAcceptFriend = useCallback(async (senderId: string, notifId: number) => {
    const friendshipId = pendingMap.get(senderId);
    if (!friendshipId) return;
    const { error } = await acceptRequest(friendshipId, user!.id);
    if (error) return;
    setRespondedIds((prev) => new Set(prev).add(senderId));
    // Mark notification as read
    await markAsRead(notifId, user!.id);
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, read: true } : n));
    refreshUnreadCount();
  }, [pendingMap, refreshUnreadCount, user]);

  const handleDeclineFriend = useCallback(async (senderId: string, notifId: number) => {
    const friendshipId = pendingMap.get(senderId);
    if (!friendshipId) return;
    const { error } = await declineRequest(friendshipId, user!.id);
    if (error) return;
    setRespondedIds((prev) => new Set(prev).add(senderId));
    await markAsRead(notifId, user!.id);
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, read: true } : n));
    refreshUnreadCount();
  }, [pendingMap, refreshUnreadCount, user]);

  const handleClearAll = useCallback(async () => {
    await clearAll();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [clearAll]);

  const formatTime = useCallback((dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return s('justNow');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }, [s]);

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [notifications],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={headerFg} />
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
              <Lucide name="trash-2" size={18} color={headerFg} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, paddingTop: 8 }}>
          <SkeletonList count={4}><NotificationSkeleton /></SkeletonList>
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell-off"
          title={s('emptyNotificationsTitle')}
          description={s('emptyNotificationsDesc')}
          iconColor={colors.textFaint}
        />
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item: n, index }) => {
            const icon = ICON_MAP[n.type] || ICON_MAP.friend_request;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
                <SwipeableRow onDelete={() => handleDelete(n.id)} colors={colors}>
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
              </Animated.View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function createSwStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      position: 'relative',
      marginHorizontal: Spacing.sm,
      marginTop: Spacing.xs,
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
      borderRadius: Radius.md,
    },
  });
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? colors.bgAlt : colors.primary,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      minHeight: 52,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    actionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    emptyText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textFaint,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
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
      ...Shadows.sm,
    },
    cardContent: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.text,
    },
    cardTitleUnread: {
      fontWeight: FontWeight.bold,
    },
    cardBody: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textMuted,
    },
    cardTime: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    inlineActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginTop: 6,
    },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.xxs,
      ...Shadows.sm,
    },
    acceptBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    declineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.xxs,
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    declineBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.medium,
      color: colors.red,
    },
    respondedText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
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
