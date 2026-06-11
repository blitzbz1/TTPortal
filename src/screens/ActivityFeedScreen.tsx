// NOTE (T055 decision, 2026-06): this screen is deliberately unrouted.
// The feed chain (screen + useFeedQuery + services/feed + feedCache) is kept
// — not deleted — because features_suggestions.md resurrects it for the
// Session Moments feature, and the service layer was just migrated to the
// auth.uid()-derived get_friend_feed RPC (migration 083). Route it when the
// feature ships; if Session Moments is descoped, delete the whole chain.
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { NotificationSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useFeedQuery } from '../hooks/queries/useFeedQuery';

export function ActivityFeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [refreshing, setRefreshing] = useState(false);

  // The feed RPC derives friendships from auth.uid() server-side
  // (migration 083) — no client-side friend-id fetch needed.
  const { data: feed = [], isLoading, refetch } = useFeedQuery(user?.id, !!user);
  const loading = isLoading && feed.length === 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  const renderStars = useCallback((rating: number) => {
    const full = Math.floor(rating);
    const empty = 5 - full;
    return '\u2605'.repeat(full) + '\u2606'.repeat(empty);
  }, []);

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Text style={styles.headerTitle}>{s('tabActivity')}</Text>
        </View>
        <EmptyState
          icon="log-in"
          title={s('authLogin')}
          description={s('emptyFeedDesc')}
          ctaLabel={s('authLogin')}
          onCtaPress={() => router.push('/sign-in')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('tabActivity')}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, paddingTop: 8 }}>
          <SkeletonList count={5}><NotificationSkeleton /></SkeletonList>
        </View>
      ) : feed.length === 0 ? (
        <EmptyState
          icon="activity"
          title={s('emptyFeedTitle')}
          description={s('emptyFeedDesc')}
          iconColor={colors.primaryLight}
          iconBg={colors.primaryPale}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          {feed.map((item, index) => {
            const isCheckin = item.type === 'checkin';
            const iconName = isCheckin ? 'map-pin' : 'star';
            const iconColor = isCheckin ? colors.primaryLight : colors.accent;
            const iconBg = isCheckin ? colors.primaryPale : colors.amberPale;
            const actionText = isCheckin ? s('feedCheckinAction') : s('feedReviewAction');

            return (
              <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
              <TouchableOpacity
                style={styles.feedCard}
                onPress={() => router.push({ pathname: '/venue/[id]', params: { id: String(item.venueId) } })}
                activeOpacity={0.7}
                testID={`feed-item-${item.id}`}
              >
                <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                  <Lucide name={iconName} size={18} color={iconColor} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardText}>
                    <Text style={styles.userName}>{item.userName}</Text>
                    {' '}{actionText}{' '}
                    <Text style={styles.venueName}>{item.venueName}</Text>
                  </Text>
                  {item.type === 'review' && item.rating != null && (
                    <Text style={styles.ratingText}>{renderStars(item.rating)}</Text>
                  )}
                  <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
                </View>
              </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
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
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      minHeight: 52,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    feedCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 14,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
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
      gap: 3,
    },
    cardText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.text,
      lineHeight: 18,
    },
    userName: {
      fontWeight: FontWeight.bold,
    },
    venueName: {
      fontWeight: FontWeight.semibold,
      color: colors.primaryMid,
    },
    ratingText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.accent,
    },
    timeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
  });
}
