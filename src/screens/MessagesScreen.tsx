import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Lucide } from '../components/Icon';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { getDateLocale } from '../contexts/I18nProvider';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Shadows, Spacing } from '../theme';
import { useDmThreadsQuery, type DmThread } from '../features/messaging';

function initials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function MessagesScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { s, lang } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: threads = [], isLoading, refetch } = useDmThreadsQuery(user?.id);

  useFocusRefresh(() => refetch(), [refetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openThread = useCallback((t: DmThread) => {
    const path: string = `/messages/${t.threadId}?otherName=${encodeURIComponent(t.otherName ?? '')}`;
    router.push(path as Href);
  }, [router]);

  const renderItem = useCallback(({ item: t }: { item: DmThread }) => {
    const time = t.lastMessageAt
      ? new Date(t.lastMessageAt).toLocaleDateString(getDateLocale(lang), { day: '2-digit', month: '2-digit' })
      : '';
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => openThread(t)} testID={`dm-thread-${t.threadId}`}>
        <Card shadow="sm" borderRadius={14} style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryMid }]}>
            <Text style={styles.avatarText}>{initials(t.otherName)}</Text>
          </View>
          <View style={styles.info}>
            <View style={styles.topRow}>
              <Text style={styles.name} numberOfLines={1}>{t.otherName || s('user')}</Text>
              {time ? <Text style={styles.time}>{time}</Text> : null}
            </View>
            <Text style={[styles.preview, t.unreadCount > 0 && styles.previewUnread]} numberOfLines={1}>
              {t.lastMessage ?? ''}
            </Text>
          </View>
          {t.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{t.unreadCount > 9 ? '9+' : t.unreadCount}</Text>
            </View>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  }, [colors, lang, openThread, s, styles]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={s('back')}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('messagesTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading && threads.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : threads.length === 0 ? (
        <EmptyState
          icon="send"
          title={s('messagesEmptyTitle')}
          description={s('messagesEmptyDesc')}
          iconColor={colors.primaryLight}
          iconBg={colors.primaryPale}
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => String(t.threadId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.bgAlt, height: 52, paddingHorizontal: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border, ...Shadows.bar,
    },
    headerTitle: { fontFamily: Fonts.heading, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.text },
    list: { padding: Spacing.md, gap: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, gap: Spacing.sm },
    avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: Fonts.body, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
    info: { flex: 1, gap: 2 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs },
    name: { fontFamily: Fonts.body, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text, flexShrink: 1 },
    time: { fontFamily: Fonts.body, fontSize: FontSize.sm, color: colors.textFaint },
    preview: { fontFamily: Fonts.body, fontSize: FontSize.base, color: colors.textFaint },
    previewUnread: { color: colors.text, fontWeight: FontWeight.semibold },
    unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    unreadText: { fontFamily: Fonts.body, fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.textOnPrimary },
  });
}
