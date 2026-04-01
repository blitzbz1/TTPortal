import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card } from '../components/Card';
import { Lucide } from '../components/Icon';
import { FavoriteCardSkeleton, SkeletonList } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useNotifications } from '../hooks/useNotifications';
import { getFavorites, removeFavorite } from '../services/favorites';

type SortMode = 'recent' | 'name';

interface FavoritesScreenProps {
  hideTabBar?: boolean;
}

export function FavoritesScreen({ hideTabBar = false }: FavoritesScreenProps) {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const { s } = useI18n();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const headerFg = isDark ? colors.text : colors.textOnPrimary;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await getFavorites(user.id);
      if (error) {
        Alert.alert(s('error'), s('favLoadError'));
      } else {
        setFavorites(data ?? []);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavorites();
    setRefreshing(false);
  }, [fetchFavorites]);

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [fetchFavorites])
  );

  const handleRemove = useCallback(async (venueId: number) => {
    if (!user) return;
    const { error } = await removeFavorite(user.id, venueId);
    if (error) {
      Alert.alert(s('error'), s('favRemoveError'));
      return;
    }
    setFavorites((prev) => prev.filter((f) => f.venue_id !== venueId));
  }, [user]);

  const handleToggleSort = useCallback(() => {
    setSortMode((prev) => (prev === 'recent' ? 'name' : 'recent'));
  }, []);

  const sortedFavorites = [...favorites].sort((a, b) => {
    if (sortMode === 'name') {
      const nameA = a.venues?.name ?? '';
      const nameB = b.venues?.name ?? '';
      return nameA.localeCompare(nameB, 'ro');
    }
    // 'recent' — sort by created_at descending
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const getVenueTypeInfo = (venue: any) => {
    const type = venue?.type;
    if (type === 'park' || type === 'outdoor') {
      return {
        label: s('favPark'),
        bg: colors.primaryDim,
        iconColor: colors.primaryLight,
        iconBg: colors.primaryPale,
      };
    }
    if (type === 'club' || type === 'indoor') {
      return {
        label: s('favHall'),
        bg: colors.bluePale,
        iconColor: colors.blue,
        iconBg: colors.bluePale,
      };
    }
    return {
      label: s('favPlace'),
      bg: colors.primaryDim,
      iconColor: colors.primaryLight,
      iconBg: colors.primaryPale,
    };
  };

  const getConditionInfo = (venue: any) => {
    const rating = venue?.venue_stats?.[0]?.avg_rating ?? venue?.venue_stats?.avg_rating;
    if (rating && rating >= 4.5) {
      return { label: s('condPro'), color: colors.blue, dot: colors.conditionPro };
    }
    if (rating && rating >= 3.5) {
      return { label: s('condGood'), color: colors.primaryLight, dot: colors.primaryLight };
    }
    return { label: s('condAvg'), color: colors.accent, dot: colors.accent };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('favorites')}</Text>
        <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/(protected)/notifications' as any)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Lucide name="bell" size={18} color={headerFg} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        {loading ? (
          <View style={{ gap: 10 }}>
            <SkeletonList count={3}><FavoriteCardSkeleton /></SkeletonList>
          </View>
        ) : sortedFavorites.length === 0 ? (
          <EmptyState
            icon="heart"
            title={s('emptyFavoritesTitle')}
            description={s('emptyFavoritesDesc')}
            ctaLabel={s('emptyFavoritesCta')}
            onCtaPress={() => router.push('/(tabs)/' as any)}
            iconColor={colors.red}
            iconBg={colors.redPale}
          />
        ) : (
          sortedFavorites.map((fav) => {
            const venue = fav.venues;
            const typeInfo = getVenueTypeInfo(venue);
            const condInfo = getConditionInfo(venue);
            const rating = venue?.venue_stats?.[0]?.avg_rating ?? venue?.venue_stats?.avg_rating;
            const savedDate = new Date(fav.created_at).toLocaleDateString('ro-RO');

            return (
              <Card key={fav.id} shadow="sm" borderRadius={14} style={styles.favCard}>
                <TouchableOpacity
                  style={styles.favCardInner}
                  onPress={() => router.push(`/venue/${fav.venue_id}` as any)}
                  accessibilityLabel={venue?.name ?? 'venue'}
                >
                  <View style={[styles.favIcon, { backgroundColor: typeInfo.iconBg }]}>
                    <Lucide name="map-pin" size={22} color={typeInfo.iconColor} />
                  </View>
                  <View style={styles.favInfo}>
                    <Text style={styles.favName}>{venue?.name ?? s('venue')}</Text>
                    <View style={styles.favMeta}>
                      <View style={[styles.favType, { backgroundColor: typeInfo.bg }]}>
                        <Text style={styles.favTypeText}>{typeInfo.label}</Text>
                      </View>
                      <View style={[styles.conditionDot, { backgroundColor: condInfo.dot }]} />
                      <Text style={[styles.favCondition, { color: condInfo.color }]}>
                        {condInfo.label}
                      </Text>
                      {rating != null && (
                        <Text style={styles.favStars}>{'\u2605'} {Number(rating).toFixed(1)}</Text>
                      )}
                    </View>
                    <Text style={styles.favSub}>
                      {venue?.city ?? ''} {'\u00B7'} {s('saved')} {savedDate}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(fav.venue_id)}>
                    <Lucide name="heart" size={22} color={colors.red} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </Card>
            );
          })
        )}
      </ScrollView>

    </View>
  );
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
      minHeight: 52,
      paddingHorizontal: Spacing.md,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: isDark ? colors.text : colors.textOnPrimary,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bellBtn: {
      position: 'relative',
      padding: Spacing.xxs,
    },
    bellBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: colors.red,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    bellBadgeText: {
      fontFamily: Fonts.body,
      fontSize: 9,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentBright,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
      gap: 4,
      ...Shadows.md,
    },
    sortText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.md,
      paddingTop: Spacing.sm,
      gap: 10,
    },
    favCard: {
      marginBottom: 4,
    },
    favCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: Spacing.sm,
    },
    favIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favInfo: {
      flex: 1,
      gap: 3,
    },
    favName: {
      fontFamily: Fonts.body,
      fontSize: 15,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    favMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    favType: {
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    favTypeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
    conditionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    favCondition: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
    },
    favStars: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      color: colors.amber,
    },
    favSub: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
  });
}
