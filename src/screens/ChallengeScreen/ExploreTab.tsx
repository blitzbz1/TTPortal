// F051: the "Explore" section of the Challenges screen. City-scoped venue
// explorer quests with progress rings, earned tier pips (reusing the badge
// tier palette), and a per-quest "Find one" jump to the pre-filtered map.
import React from 'react';
import { Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from '../../components/Icon';
import type { ThemeColors } from '../../theme';
import type { BadgeTier } from '../../features/challenges/badgeDefinitions';
import { getBadgeTierPalette } from '../../features/challenges/badgeDefinitions';
import {
  EXPLORER_QUEST_META,
  EXPLORER_TIERS,
  explorerCurrentTier,
  explorerTierEarned,
  explorerTierTarget,
  type ExplorerProgress,
} from '../../features/explorer';
import type { createStyles } from '../ChallengeScreen.styles';

interface Props {
  quests: ExplorerProgress[];
  cityName: string | null;
  loading: boolean;
  error: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onFindOne: (quest: ExplorerProgress) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  s: (key: string, ...args: string[]) => string;
  sn: (key: string, count: number, ...args: string[]) => string;
  tierLabel: (tier: BadgeTier) => string;
}

export function ExploreTab({
  quests,
  cityName,
  loading,
  error,
  refreshing,
  onRefresh,
  onFindOne,
  styles,
  colors,
  s,
  sn,
  tierLabel,
}: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      testID="explore-tab"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
      }
    >
      <View style={[styles.sectionHeader, styles.centeredHeader]}>
        <Text style={styles.sectionTitle}>{s('explorerTitle')}</Text>
        <Text style={styles.sectionCopy}>
          {cityName ? s('explorerSubtitleCity', cityName) : s('explorerSubtitle')}
        </Text>
      </View>

      {error && quests.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Lucide name="compass" size={24} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>{s('explorerLoadError')}</Text>
          <Text style={styles.emptyText}>{s('explorerLoadErrorDesc')}</Text>
        </View>
      ) : loading && quests.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>{s('loading')}</Text>
        </View>
      ) : (
        quests.map((quest) => {
          const meta = EXPLORER_QUEST_META[quest.key];
          const color = meta?.color ?? colors.primary;
          const paleColor = meta?.paleColor ?? colors.primaryPale;
          const icon = meta?.icon ?? 'compass';
          const currentTier = explorerCurrentTier(quest);
          const target = explorerTierTarget(quest, currentTier);
          const progress = Math.min(quest.progress, target);
          const fillWidth = `${Math.min(100, target > 0 ? (progress / target) * 100 : 100)}%` as `${number}%`;
          const allEarned = quest.earned_bronze && quest.earned_silver && quest.earned_gold;
          return (
            <View key={quest.key} style={styles.explorerCard} testID={`explorer-quest-${quest.key}`}>
              <View style={styles.explorerCardHeader}>
                <View style={[styles.explorerCardIcon, { backgroundColor: paleColor }]}>
                  {meta?.badgeSource ? (
                    <Image
                      source={meta.badgeSource}
                      resizeMode="contain"
                      style={styles.explorerBadgeImage}
                    />
                  ) : (
                    <Lucide name={icon} size={22} color={color} />
                  )}
                </View>
                <View style={styles.explorerCardCopy}>
                  <Text style={styles.explorerCardTitle}>{s(`explorerQuest_${quest.key}_title`)}</Text>
                  <Text style={styles.explorerCardSub}>{s(`explorerQuest_${quest.key}_desc`)}</Text>
                </View>
                <Text style={[styles.explorerCardCount, { color }]} testID={`explorer-count-${quest.key}`}>
                  {quest.progress}/{target}
                </Text>
              </View>

              <View style={styles.explorerProgressBar}>
                <View style={[styles.explorerProgressFill, { width: fillWidth, backgroundColor: color }]} />
              </View>

              <View style={styles.explorerTierRow}>
                {EXPLORER_TIERS.map((tier) => {
                  const earned = explorerTierEarned(quest, tier);
                  const palette = getBadgeTierPalette(tier);
                  return (
                    <View
                      key={tier}
                      style={[
                        styles.explorerTierPip,
                        {
                          backgroundColor: earned ? palette.surface : colors.bgMuted,
                          borderColor: earned ? palette.border : colors.borderLight,
                        },
                      ]}
                      testID={`explorer-tier-${quest.key}-${tier}${earned ? '-earned' : ''}`}
                    >
                      <Lucide
                        name={earned ? 'medal' : 'lock'}
                        size={10}
                        color={earned ? palette.accent : colors.textFaint}
                      />
                      <Text
                        style={[
                          styles.explorerTierPipText,
                          { color: earned ? palette.accent : colors.textFaint },
                        ]}
                      >
                        {tierLabel(tier)} · {explorerTierTarget(quest, tier)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.explorerCardActions}>
                <Text style={styles.explorerCardSub}>
                  {allEarned
                    ? s('explorerQuestComplete')
                    : sn('explorerVenuesToNext', Math.max(0, target - quest.progress), tierLabel(currentTier))}
                </Text>
                <TouchableOpacity
                  style={[styles.explorerFindBtn, { borderColor: color, backgroundColor: paleColor }]}
                  onPress={() => onFindOne(quest)}
                  testID={`explorer-find-${quest.key}`}
                  activeOpacity={0.86}
                >
                  <Lucide name="map-pin" size={14} color={color} />
                  <Text style={[styles.explorerFindBtnText, { color }]}>{s('explorerFindOne')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
