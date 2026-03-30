import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '../components/Icon';
import { CityPickerModal } from '../components/CityPickerModal';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius, Shadows } from '../theme';
import { useSession } from '../hooks/useSession';
import { useI18n } from '../hooks/useI18n';
import { getLeaderboard } from '../services/leaderboard';

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
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LBTab>('checkins');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const { s } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const COLOR_BY_RANK: Record<number, string> = { 1: colors.primary, 2: colors.primaryMid, 3: colors.accent };
  const PODIUM_COLORS = [colors.primaryMid, colors.primary, colors.accent];

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const type = TAB_TO_TYPE[activeTab];
      const { data } = await getLeaderboard(type, selectedCity ?? undefined);
      if (data) {
        setEntries(data);
      } else {
        setEntries([]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, [fetchLeaderboard]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getScoreLabel = (entry: any) => {
    if (activeTab === 'checkins') return `${entry.total_checkins ?? entry.score ?? 0} ${s('checkins').toLowerCase()}`;
    if (activeTab === 'reviews') return `${entry.total_reviews ?? entry.score ?? 0} ${s('reviews').toLowerCase()}`;
    return `${entry.unique_venues ?? entry.score ?? 0} ${s('locations').toLowerCase()}`;
  };

  // Split into top 3 (podium) and rest
  const podiumEntries = entries.slice(0, 3);
  const rankEntries = entries.slice(3);

  // Reorder podium for display: [2nd, 1st, 3rd]
  const podiumDisplay = podiumEntries.length >= 3
    ? [podiumEntries[1], podiumEntries[0], podiumEntries[2]]
    : podiumEntries;

  // Find current user's rank
  const myEntry = entries.find((e) => e.user_id === user?.id);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>{s('leaderboard')}</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setCityModalVisible(true)}>
          <Lucide name="map-pin" size={14} color={colors.textOnPrimary} />
          <Text style={styles.filterText}>{selectedCity || s('allRomania')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
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

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40, padding: 16 }}>
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textFaint }}>
              {s('noLeaderboard')}
            </Text>
          </View>
        ) : (
          <>
            {/* Podium */}
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
                        {
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor: color,
                        },
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

            {/* Rank List */}
            <View style={styles.rankList}>
              {rankEntries.map((r, idx) => (
                <View key={r.user_id ?? idx} style={styles.rankRow}>
                  <Text style={styles.rankNum}>{r.rank ?? idx + 4}</Text>
                  <View style={[styles.rankAvatar, { backgroundColor: PODIUM_COLORS[idx % PODIUM_COLORS.length] }]}>
                    <Text style={styles.rankInitials}>{getInitials(r.full_name)}</Text>
                  </View>
                  <View style={styles.rankInfo}>
                    <Text style={styles.rankName}>{r.full_name ?? s('user')}</Text>
                    <Text style={styles.rankScore}>{getScoreLabel(r)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* My Rank */}
            {myEntry && (
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
            )}
          </>
        )}
      </ScrollView>


      <CityPickerModal
        visible={cityModalVisible}
        selectedCity={selectedCity}
        onSelect={(c) => { setSelectedCity(c); setCityModalVisible(false); }}
        onClose={() => setCityModalVisible(false)}
      />
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
      minHeight: 52,
      paddingHorizontal: 16,
      ...Shadows.bar,
    },
    headerTitle: {
      fontFamily: Fonts.heading,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textOnPrimary,
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
      fontSize: 12,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    scroll: {
      flex: 1,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
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
      fontSize: 14,
      color: colors.textFaint,
    },
    tabTextActive: {
      fontWeight: '600',
      color: colors.primary,
    },
    podium: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingVertical: 24,
      paddingHorizontal: 24,
      gap: 12,
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
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    podiumName: {
      fontFamily: Fonts.body,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    podiumNameHighlight: {
      fontSize: 14,
      fontWeight: '700',
    },
    podiumScore: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: colors.textFaint,
    },
    podiumScoreHighlight: {
      color: colors.primaryLight,
      fontWeight: '600',
    },
    rankList: {
      paddingHorizontal: 16,
      gap: 2,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      padding: 10,
      paddingHorizontal: 12,
      gap: 12,
    },
    rankNum: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '700',
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
      fontSize: 13,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    rankInfo: {
      flex: 1,
      gap: 1,
    },
    rankName: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    rankScore: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textFaint,
    },
    myRank: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryPale,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.primaryDim,
      ...Shadows.md,
    },
    myNum: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      width: 20,
      textAlign: 'center',
    },
    myName: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    myScore: {
      fontFamily: Fonts.body,
      fontSize: 12,
      fontWeight: '500',
      color: colors.primaryLight,
    },
  });
}
