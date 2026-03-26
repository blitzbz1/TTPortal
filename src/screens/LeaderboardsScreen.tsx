import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Lucide } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { Colors, Fonts, Radius } from '../theme';

type LBTab = 'checkins' | 'reviews' | 'locations';

const PODIUM = [
  { rank: '\uD83E\uDD48', initials: 'EV', name: 'Elena V.', score: '89 check-ins', color: Colors.greenMid, size: 52 },
  { rank: '\uD83E\uDD47', initials: 'RC', name: 'Radu C.', score: '124 check-ins', color: Colors.green, size: 64, highlight: true },
  { rank: '\uD83E\uDD49', initials: 'SN', name: 'Sergiu N.', score: '72 check-ins', color: Colors.orange, size: 52 },
];

const RANKS = [
  { num: '4', initials: 'AT', name: 'Ana Tudor', score: '65 check-ins', color: Colors.purple },
  { num: '5', initials: 'MI', name: 'Mihai Ionescu', score: '58 check-ins', color: Colors.inkMuted },
  { num: '6', initials: 'LP', name: 'Laura Popescu', score: '51 check-ins', color: Colors.purpleMid },
  { num: '7', initials: 'DM', name: 'Dan Marin', score: '44 check-ins', color: Colors.blue },
];

export function LeaderboardsScreen() {
  const [activeTab, setActiveTab] = useState<LBTab>('checkins');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Lucide name="arrow-left" size={24} color={Colors.ink} />
        <Text style={styles.headerTitle}>Clasament</Text>
        <TouchableOpacity style={styles.filterBtn}>
          <Lucide name="map-pin" size={14} color={Colors.inkMuted} />
          <Text style={styles.filterText}>Bucure&#537;ti</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { key: 'checkins' as LBTab, label: 'Check-ins' },
            { key: 'reviews' as LBTab, label: 'Recenzii' },
            { key: 'locations' as LBTab, label: 'Loca\u021Bii' },
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

        {/* Podium */}
        <View style={styles.podium}>
          {[PODIUM[0], PODIUM[1], PODIUM[2]].map((p) => (
            <View key={p.name} style={[styles.podiumItem, { width: p.highlight ? 100 : 90 }]}>
              <Text style={styles.podiumRank}>{p.rank}</Text>
              <View
                style={[
                  styles.podiumAvatar,
                  {
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    backgroundColor: p.color,
                  },
                  p.highlight && styles.podiumAvatarHighlight,
                ]}
              >
                <Text style={[styles.podiumInitials, { fontSize: p.highlight ? 22 : 18 }]}>
                  {p.initials}
                </Text>
              </View>
              <Text style={[styles.podiumName, p.highlight && styles.podiumNameHighlight]}>
                {p.name}
              </Text>
              <Text style={[styles.podiumScore, p.highlight && styles.podiumScoreHighlight]}>
                {p.score}
              </Text>
            </View>
          ))}
        </View>

        {/* Rank List */}
        <View style={styles.rankList}>
          {RANKS.map((r) => (
            <View key={r.name} style={styles.rankRow}>
              <Text style={styles.rankNum}>{r.num}</Text>
              <View style={[styles.rankAvatar, { backgroundColor: r.color }]}>
                <Text style={styles.rankInitials}>{r.initials}</Text>
              </View>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName}>{r.name}</Text>
                <Text style={styles.rankScore}>{r.score}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* My Rank */}
        <View style={styles.myRank}>
          <Text style={styles.myNum}>15</Text>
          <View style={[styles.rankAvatar, { backgroundColor: Colors.green }]}>
            <Text style={styles.rankInitials}>AM</Text>
          </View>
          <View style={styles.rankInfo}>
            <Text style={styles.myName}>Tu &#8212; Andrei Marinescu</Text>
            <Text style={styles.myScore}>47 check-ins</Text>
          </View>
          <Lucide name="trending-up" size={18} color={Colors.greenLight} />
        </View>
      </ScrollView>

      <TabBar activeTab="leaderboard" />
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
