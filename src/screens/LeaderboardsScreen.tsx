import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { CityPickerModal } from '../components/CityPickerModal';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { useLeaderboardQuery } from '../hooks/queries/useLeaderboardQuery';
import { LeaderboardSkeleton } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { hapticSelection } from '../lib/haptics';

type LBTab = 'checkins' | 'reviews' | 'locations';

const TAB_TO_TYPE: Record<LBTab, 'checkins' | 'reviews' | 'venues'> = {
  checkins: 'checkins',
  reviews: 'reviews',
  locations: 'venues',
};

// Medal by rank value (1=gold, 2=silver, 3=bronze)
const MEDAL_BY_RANK: Record<number, string> = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' };

interface LeaderboardsScreenProps {
  hideTabBar?: boolean;
}

export function LeaderboardsScreen({ hideTabBar = false }: LeaderboardsScreenProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LBTab>('checkins');
  const [period, setPeriod] = useState<'week' | 'all'>('all');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const COLOR_BY_RANK: Record<number, string> = { 1: colors.primary, 2: colors.primaryMid, 3: colors.accent };
  const PODIUM_COLORS = [colors.primaryMid, colors.primary, colors.accent];

  const type = TAB_TO_TYPE[activeTab];
  const { data: entries = [], isLoading, refetch } = useLeaderboardQuery(
    type,
    selectedCity ?? undefined,
    period,
  );
  const loading = isLoading && entries.length === 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getInitials = useCallback((name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, []);

  const getScoreLabel = useCallback((entry: any) => {
    if (activeTab === 'checkins') return `${entry.total_checkins ?? entry.score ?? 0} ${s('checkins').toLowerCase()}`;
    if (activeTab === 'reviews') return `${entry.total_reviews ?? entry.score ?? 0} ${s('reviews').toLowerCase()}`;
    return `${entry.unique_venues ?? entry.score ?? 0} ${s('locations').toLowerCase()}`;
  }, [activeTab, s]);

  // Memoized so identity-stable arrays flow into the FlatList renderer.
  const { podiumDisplay, rankEntries, myEntry } = useMemo(() => {
    const top3 = entries.slice(0, 3);
    const rest = entries.slice(3);
    const podium = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    return {
      podiumDisplay: podium,
      rankEntries: rest,
      myEntry: entries.find((e) => e.user_id === user?.id),
    };
  }, [entries, user?.id]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{s('leaderboard')}</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setCityModalVisible(true)}>
          <Lucide name="map-pin" size={14} color={colors.textOnPrimary} />
          <Text style={styles.filterText}>{selectedCity || s('allRomania')}</Text>
        </TouchableOpacity>
      </View>

      {(() => {
        const Header = (
          <>
            {/* Period Toggle */}
            <View style={styles.periodWrap}>
              <View style={styles.periodToggle}>
                {([
                  { key: 'week' as const, label: s('periodWeek') },
                  { key: 'all' as const, label: s('periodAll') },
                ]).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.periodOption, period === opt.key && styles.periodOptionActive]}
                    onPress={() => { hapticSelection(); setPeriod(opt.key); }}
                  >
                    <Text style={[styles.periodText, period === opt.key && styles.periodTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              {[
                { key: 'checkins' as LBTab, label: s('checkins') },
                { key: 'reviews' as LBTab, label: s('reviews') },
                { key: 'locations' as LBTab, label: s('locations') },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!loading && entries.length > 0 && (
              <View style={styles.podium}>
                {podiumDisplay.map((p, idx) => {
                  const rank = p.rank ?? (idx + 1);
                  const isHighlight = rank === 1;
                  const size = isHighlight ? 64 : 52;
                  const color = COLOR_BY_RANK[rank] ?? colors.primary;
                  return (
                    <View key={p.user_id ?? idx} style={[styles.podiumItem, { width: isHighlight ? 100 : 90 }]}>
                      <Text style={styles.podiumRank}>{MEDAL_BY_RANK[rank] ?? ''}</Text>
                      <View
                        style={[
                          styles.podiumAvatar,
                          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
                          isHighlight && styles.podiumAvatarHighlight,
                        ]}
                      >
                        <Text style={[styles.podiumInitials, { fontSize: isHighlight ? 22 : 18 }]}>
                          {getInitials(p.full_name)}
                        </Text>
                      </View>
                      <Text style={[styles.podiumName, isHighlight && styles.podiumNameHighlight]}>
                        {p.full_name
                          ? `${p.full_name.split(' ')[0]} ${(p.full_name.split(' ')[1] ?? '')[0] ?? ''}.`
                          : s('user')}
                      </Text>
                      <Text style={[styles.podiumScore, isHighlight && styles.podiumScoreHighlight]}>
                        {getScoreLabel(p)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        );

        const Footer = !loading && entries.length > 0 && myEntry ? (
          <View style={styles.myRank}>
            <Text style={styles.myNum}>{myEntry.rank ?? '—'}</Text>
            <View style={[styles.rankAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.rankInitials}>
                {getInitials(myEntry.full_name ?? user?.user_metadata?.full_name)}
              </Text>
            </View>
            <View style={styles.rankInfo}>
              <Text style={styles.myName}>
                {s('you')} — {myEntry.full_name ?? user?.user_metadata?.full_name ?? s('user')}
              </Text>
              <Text style={styles.myScore}>{getScoreLabel(myEntry)}</Text>
            </View>
            <Lucide name="trending-up" size={18} color={colors.primaryLight} />
          </View>
        ) : null;

        if (loading) {
          return (
            <ScrollView style={styles.scroll}>
              {Header}
              <LeaderboardSkeleton />
            </ScrollView>
          );
        }
        if (entries.length === 0) {
          return (
            <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
              {Header}
              <EmptyState
                icon="trophy"
                title={s('emptyLeaderboardTitle')}
                description={s('emptyLeaderboardDesc')}
                iconColor={colors.accent}
                iconBg={colors.amberPale}
              />
            </ScrollView>
          );
        }
        return (
          <FlashList
            data={rankEntries}
            keyExtractor={(r, idx) => r.user_id ?? String(idx)}
            ListHeaderComponent={Header}
            ListFooterComponent={Footer}
            refreshing={refreshing}
            onRefresh={onRefresh}
            drawDistance={400}
            renderItem={({ item: r, index: idx }) => (
              <View style={styles.rankList}>
                <Animated.View entering={FadeInDown.delay(Math.min(idx, 8) * 60).duration(300)}>
                  <View style={styles.rankRow}>
                    <Text style={styles.rankNum}>{r.rank ?? idx + 4}</Text>
                    <View style={[styles.rankAvatar, { backgroundColor: PODIUM_COLORS[idx % PODIUM_COLORS.length] }]}>
                      <Text style={styles.rankInitials}>{getInitials(r.full_name)}</Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{r.full_name ?? s('user')}</Text>
                      <Text style={styles.rankScore}>{getScoreLabel(r)}</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            )}
          />
        );
      })()}


      <CityPickerModal
        visible={cityModalVisible}
        selectedCity={selectedCity}
        onSelect={(c) => { setSelectedCity(c); setCityModalVisible(false); }}
        onClose={() => setCityModalVisible(false)}
      />
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
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentBright,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
      gap: 4,
      ...Shadows.sm,
    },
    filterText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    periodWrap: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: 4,
    },
    periodToggle: {
      flexDirection: 'row',
      backgroundColor: colors.bgMuted,
      borderRadius: 8,
      padding: 3,
    },
    periodOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 7,
      borderRadius: 6,
    },
    periodOptionActive: {
      backgroundColor: colors.bgAlt,
      ...Shadows.sm,
    },
    periodText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
    },
    periodTextActive: {
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.md,
    },
    tab: {
      flex: 1,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textFaint,
    },
    tabTextActive: {
      fontWeight: FontWeight.semibold,
      color: colors.primary,
    },
    podium: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    podiumItem: {
      alignItems: 'center',
      gap: 6,
    },
    podiumRank: {
      fontSize: 22,
    },
    podiumAvatar: {
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.sm,
    },
    podiumAvatarHighlight: {
      borderWidth: 3,
      borderColor: colors.primaryLight,
    },
    podiumInitials: {
      fontFamily: Fonts.body,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    podiumName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    podiumNameHighlight: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
    },
    podiumScore: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    podiumScoreHighlight: {
      color: colors.primaryLight,
      fontWeight: FontWeight.semibold,
    },
    rankList: {
      paddingHorizontal: Spacing.md,
      gap: 2,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: 10,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.sm,
    },
    rankNum: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      width: 20,
      textAlign: 'center',
    },
    rankAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankInitials: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
    },
    rankInfo: {
      flex: 1,
      gap: 1,
    },
    rankName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    rankScore: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      color: colors.textFaint,
    },
    myRank: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryPale,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.primaryDim,
      ...Shadows.md,
    },
    myNum: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      width: 20,
      textAlign: 'center',
    },
    myName: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.primary,
    },
    myScore: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.medium,
      color: colors.primaryLight,
    },
  });
}
