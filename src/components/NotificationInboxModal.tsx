import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useNotificationHistory, type NotificationRecord } from '../hooks/useNotificationHistory';
import { acceptRequest, declineRequest, getPendingRequests } from '../services/friends';
import { sanitizeRoute } from '../lib/auth-utils';
import { NotificationSkeleton, SkeletonList } from './SkeletonLoader';
import { EmptyState } from './EmptyState';
import { SwipeableDeleteRow } from './SwipeableDeleteRow';

export interface NotificationInboxModalRef {
  present: () => void;
  dismiss: () => void;
}

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

export const NotificationInboxModal = forwardRef<NotificationInboxModalRef>(function NotificationInboxModal(_props, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { user } = useSession();
  const { s } = useI18n();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ICON_MAP = useMemo(() => getIconMap(colors), [colors]);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const {
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
  } = useNotificationHistory();

  const [pendingMap, setPendingMap] = useState<Map<string, number>>(new Map());
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await getPendingRequests(user.id);
      if (cancelled || !data) return;
      const map = new Map<string, number>();
      for (const p of data) map.set(p.requester_id, p.id);
      setPendingMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = useCallback(() => sheetRef.current?.dismiss(), []);

  const handleTap = useCallback(
    async (notification: NotificationRecord) => {
      if (!notification.read) {
        await markAsRead(notification.id);
      }
      const data = notification.data as { screen?: string; eventId?: number | string } | null;
      if (data?.screen) {
        const safeRoute = sanitizeRoute(data.screen);
        const withParams =
          data.eventId != null && !safeRoute.includes('?')
            ? `${safeRoute}?eventId=${data.eventId}`
            : safeRoute;
        dismiss();
        router.push(withParams as any);
      }
    },
    [dismiss, markAsRead, router],
  );

  const handleDeleteAll = useCallback(async () => {
    if (!user) return;
    if (Platform.OS === 'web') {
      if (window.confirm(s('deleteAllConfirm'))) await deleteAll();
    } else {
      Alert.alert(s('deleteAllNotifications'), s('deleteAllConfirm'), [
        { text: s('cancel'), style: 'cancel' },
        { text: s('deleteNotification'), style: 'destructive', onPress: () => void deleteAll() },
      ]);
    }
  }, [deleteAll, s, user]);

  const handleAcceptFriend = useCallback(
    async (senderId: string, notifId: number) => {
      const friendshipId = pendingMap.get(senderId);
      if (!friendshipId || !user) return;
      const { error } = await acceptRequest(friendshipId, user.id);
      if (error) return;
      setRespondedIds((prev) => new Set(prev).add(senderId));
      await markAsRead(notifId);
    },
    [markAsRead, pendingMap, user],
  );

  const handleDeclineFriend = useCallback(
    async (senderId: string, notifId: number) => {
      const friendshipId = pendingMap.get(senderId);
      if (!friendshipId || !user) return;
      const { error } = await declineRequest(friendshipId, user.id);
      if (error) return;
      setRespondedIds((prev) => new Set(prev).add(senderId));
      await markAsRead(notifId);
    },
    [markAsRead, pendingMap, user],
  );

  const formatTime = useCallback(
    (dateStr: string) => {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return s('justNow');
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      return `${days}d`;
    },
    [s],
  );

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [notifications],
  );

  const showInitialSkeleton = isLoading && notifications.length === 0 && !isRefreshing;

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item: n }: { item: NotificationRecord }) => {
      const icon = ICON_MAP[n.type] || ICON_MAP.friend_request;
      return (
        <View style={styles.rowWrap}>
          <SwipeableDeleteRow onDelete={() => deleteNotification(n.id)}>
            <TouchableOpacity
              style={[styles.card, !n.read && styles.cardUnread]}
              onPress={() => handleTap(n)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                <Lucide name={icon.name} size={20} color={icon.color} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, !n.read && styles.cardTitleUnread]}>{n.title}</Text>
                <Text style={styles.cardBody}>{n.body}</Text>
                {n.type === 'friend_request' && n.sender_id && pendingMap.has(n.sender_id) && !respondedIds.has(n.sender_id) && (
                  <View style={styles.inlineActions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptFriend(n.sender_id!, n.id)}>
                      <Lucide name="check" size={14} color={colors.textOnPrimary} />
                      <Text style={styles.acceptBtnText}>{s('accept')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleDeclineFriend(n.sender_id!, n.id)}>
                      <Lucide name="x" size={14} color={colors.red} />
                      <Text style={styles.declineBtnText}>{s('decline')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {n.type === 'friend_request' && n.sender_id && respondedIds.has(n.sender_id) && (
                  <Text style={styles.respondedText}>{s('accepted')}</Text>
                )}
                <Text style={styles.cardTime}>{formatTime(n.created_at)}</Text>
              </View>
              {!n.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          </SwipeableDeleteRow>
        </View>
      );
    },
    [ICON_MAP, colors.red, colors.textOnPrimary, deleteNotification, formatTime, handleAcceptFriend, handleDeclineFriend, handleTap, pendingMap, respondedIds, s, styles],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['92%']}
      enableDynamicSizing={false}
      topInset={insets.top + 8}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.actionText}>{s('markAllRead')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle}>{s('notifications')}</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleDeleteAll} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Lucide name="trash-2" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Lucide name="x" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.divider} />

      {showInitialSkeleton ? (
        <View style={{ flex: 1, paddingTop: 8 }}>
          <SkeletonList count={4}>
            <NotificationSkeleton />
          </SkeletonList>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="bell-off"
            title={s('emptyNotificationsTitle')}
            description={s('emptyNotificationsDesc')}
            iconColor={colors.textFaint}
          />
        </View>
      ) : (
        <BottomSheetFlatList
          data={notifications}
          keyExtractor={(n: NotificationRecord) => String(n.id)}
          refreshing={isRefreshing}
          onRefresh={refresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            isLoading && hasMore && notifications.length > 0 ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={colors.primaryMid} />
              </View>
            ) : null
          }
          renderItem={renderItem}
        />
      )}
    </BottomSheetModal>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.sm,
    },
    headerSide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerSideRight: {
      justifyContent: 'flex-end',
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    actionText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.primaryMid,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    listContent: {
      paddingBottom: Spacing.xl,
    },
    emptyWrap: {
      flex: 1,
    },
    rowWrap: {
      marginHorizontal: Spacing.sm,
      marginTop: Spacing.xs,
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
    footer: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
  });
}
