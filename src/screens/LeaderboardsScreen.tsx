import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';
import { useSession } from '../hooks/useSession';
import { getLeaderboard } from '../services/leaderboard';

type LBTab = 'checkins' | 'reviews' | 'locations';

const TAB_TO_TYPE: Record<LBTab, 'checkins' | 'reviews' | 'venues'> = {
  checkins: 'checkins',
  reviews: 'reviews',
  locations: 'venues',
};

const MEDALS = ['\uD83E\uDD48', '\uD83E\uDD47', '\uD83E\uDD49'];
const PODIUM_COLORS = [Colors.greenMid, Colors.green, Colors.orange];

interface LeaderboardsScreenProps {
  hideTabBar?: boolean;
}

export function LeaderboardsScreen({ hideTabBar = false }: LeaderboardsScreenProps) {
  const [activeTab, setActiveTab] = useState<LBTab>('checkins');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useSession();
  const router = useRouter();

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const type = TAB_TO_TYPE[activeTab];
      const { data } = await getLeaderboard(type);
      if (data) {
        setEntries(data);
      } else {
        setEntries([]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getScoreLabel = (entry: any) => {
    if (activeTab === 'checkins') return `${entry.total_checkins ?? entry.score ?? 0} check-ins`;
    if (activeTab === 'reviews') return `${entry.total_reviews ?? entry.score ?? 0} recenzii`;
    return `${entry.unique_venues ?? entry.score ?? 0} locații`;
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Lucide name="arrow-left" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clasament</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => Alert.alert('În curând', 'Această funcție va fi disponibilă în curând.')}>
          <Lucide name="map-pin" size={14} color={Colors.inkMuted} />
          <Text style={styles.filterText}>București</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'checkins' as LBTab, label: 'Check-ins' },
            { key: 'reviews' as LBTab, label: 'Recenzii' },
            { key: 'locations' as LBTab, label: 'Locații' },
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
          <ActivityIndicator size="large" color={Colors.green} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40, padding: 16 }}>
            <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: Colors.inkFaint }}>
              Niciun rezultat în clasament
            </Text>
          </View>
        ) : (
          <>
            {/* Podium */}
            <View style={styles.podium}>
              {podiumDisplay.map((p, idx) => {
                const isHighlight = podiumEntries.length >= 3 && idx === 1; // center = 1st place
                const originalIdx = podiumEntries.length >= 3
                  ? (idx === 0 ? 1 : idx === 1 ? 0 : 2)
                  : idx;
                const size = isHighlight ? 64 : 52;
                const color = PODIUM_COLORS[originalIdx] ?? Colors.green;

                return (
                  <View key={p.user_id ?? idx} style={[styles.podiumItem, { width: isHighlight ? 100 : 90 }]}>
                    <Text style={styles.podiumRank}>{MEDALS[originalIdx] ?? ''}</Text>
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
                        : 'Utilizator'}
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
                    <Text style={styles.rankName}>{r.full_name ?? 'Utilizator'}</Text>
                    <Text style={styles.rankScore}>{getScoreLabel(r)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* My Rank */}
            {myEntry && (
              <View style={styles.myRank}>
                <Text style={styles.myNum}>{myEntry.rank ?? '—'}</Text>
                <View style={[styles.rankAvatar, { backgroundColor: Colors.green }]}>
                  <Text style={styles.rankInitials}>
                    {getInitials(myEntry.full_name ?? user?.user_metadata?.full_name)}
                  </Text>
                </View>
                <View style={styles.rankInfo}>
                  <Text style={styles.myName}>
                    Tu — {myEntry.full_name ?? user?.user_metadata?.full_name ?? 'Utilizator'}
                  </Text>
                  <Text style={styles.myScore}>{getScoreLabel(myEntry)}</Text>
                </View>
                <Lucide name="trending-up" size={18} color={Colors.greenLight} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!hideTabBar && <TabBar activeTab="leaderboard" />}
    </View>
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
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgDark,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.inkMuted,
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
    borderBottomColor: Colors.border,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.green,
  },
  tabText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkFaint,
  },
  tabTextActive: {
    fontWeight: '600',
    color: Colors.green,
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
  },
  podiumAvatarHighlight: {
    borderWidth: 3,
    borderColor: Colors.greenLight,
  },
  podiumInitials: {
    fontFamily: Fonts.body,
    fontWeight: '700',
    color: Colors.white,
  },
  podiumName: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink,
  },
  podiumNameHighlight: {
    fontSize: 14,
    fontWeight: '700',
  },
  podiumScore: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  podiumScoreHighlight: {
    color: Colors.greenLight,
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
    color: Colors.inkFaint,
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
    color: Colors.white,
  },
  rankInfo: {
    flex: 1,
    gap: 1,
  },
  rankName: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink,
  },
  rankScore: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  myRank: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.greenPale,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.greenDim,
  },
  myNum: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.green,
    width: 20,
    textAlign: 'center',
  },
  myName: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.green,
  },
  myScore: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.greenLight,
  },
});
