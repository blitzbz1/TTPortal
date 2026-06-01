import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { getBlockedUsers, unblockUser, type BlockedUser } from '../services/moderation';
import { logger } from '../lib/logger';

export function BlockedUsersScreen() {
  const router = useRouter();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [unblocking, setUnblocking] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getBlockedUsers();
    if (error) {
      logger.warn('getBlockedUsers failed', { code: error.code });
    }
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showAlert = useCallback((title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  }, []);

  const handleUnblock = useCallback(
    async (userId: string) => {
      setUnblocking((prev) => new Set(prev).add(userId));
      const { error } = await unblockUser(userId);
      setUnblocking((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      if (error) {
        showAlert(s('error'), s('unblockError'));
        return;
      }
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    },
    [s, showAlert],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          testID="blocked-users-back"
        >
          <Lucide name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{s('blockedUsers')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={users.length === 0 && !loading ? styles.emptyContainer : undefined}
      >
        <Text style={styles.hint}>{s('blockedUsersHint')}</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} testID="blocked-users-loading" />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.empty}>
            <Lucide name="user-x" size={36} color={colors.textFaint} />
            <Text style={styles.emptyText}>{s('blockedUsersEmpty')}</Text>
          </View>
        ) : (
          users.map((u) => {
            const isUnblocking = unblocking.has(u.user_id);
            return (
              <View key={u.user_id} style={styles.row} testID={`blocked-row-${u.user_id}`}>
                {u.avatar_url ? (
                  <Image source={{ uri: u.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Lucide name="user" size={20} color={colors.textFaint} />
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {u.full_name || u.username || s('anon')}
                  </Text>
                  {u.username && u.full_name && (
                    <Text style={styles.rowUsername} numberOfLines={1}>
                      @{u.username}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => void handleUnblock(u.user_id)}
                  disabled={isUnblocking}
                  style={[styles.unblockBtn, isUnblocking && styles.unblockBtnDisabled]}
                  testID={`unblock-${u.user_id}`}
                >
                  {isUnblocking ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Text style={styles.unblockText}>{s('unblockButton')}</Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
      backgroundColor: colors.bgAlt,
      height: 52,
      paddingHorizontal: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    scroll: {
      flex: 1,
    },
    hint: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textMuted,
    },
    center: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    empty: {
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 60,
      gap: 12,
    },
    emptyText: {
      fontFamily: Fonts.body,
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.bgMuted,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowInfo: {
      flex: 1,
      gap: 2,
    },
    rowName: {
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    rowUsername: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textFaint,
    },
    unblockBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgAlt,
      minWidth: 80,
      alignItems: 'center',
    },
    unblockBtnDisabled: {
      opacity: 0.5,
    },
    unblockText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
  });
}
