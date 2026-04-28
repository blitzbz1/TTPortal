import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BadgeTrackIcon } from '../../components/BadgeTrackIcon';
import { Lucide } from '../../components/Icon';
import type { ThemeColors } from '../../theme';
import {
  BADGE_TIERS,
  BADGE_TRACKS,
  getBadgeTierPalette,
  type BadgeTier,
  type BadgeTrack,
} from '../../lib/badgeChallenges';
import type { createStyles } from '../ChallengeScreen.styles';
import { EarnedBadgeCard } from './EarnedBadgeCard';

interface Props {
  activeBadge: BadgeTrack;
  activeCategory: string;
  completedCount: number;
  earnedAtByBadgeTier: Map<string, string>;
  latestEarnedBadgeKey: string | null;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  s: (key: string, ...args: string[]) => string;
  lang: string;
  tierLabel: (tier: BadgeTier) => string;
  trackName: (badge?: BadgeTrack) => string;
  trackDescription: (badge?: BadgeTrack) => string;
  renderMonthlyMastery: () => React.ReactNode;
  renderCurrentProgress: () => React.ReactNode;
}

export function BadgesTab({
  activeBadge,
  activeCategory,
  completedCount,
  earnedAtByBadgeTier,
  latestEarnedBadgeKey,
  styles,
  colors,
  s,
  lang,
  tierLabel,
  trackName,
  trackDescription,
  renderMonthlyMastery,
  renderCurrentProgress,
}: Props) {
  const wonBadges = BADGE_TRACKS.flatMap((badge) => (
    BADGE_TIERS.flatMap((tier) => {
      const earnedAt = earnedAtByBadgeTier.get(`${badge.category}:${tier}`);
      return earnedAt ? [{ badge, tier, earnedAt }] : [];
    })
  )).sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());
  const tierSegments = BADGE_TIERS.map((tier, index) => {
    const segmentStart = index * 5;
    const segmentCompleted = Math.max(0, Math.min(5, completedCount - segmentStart));
    const tierPalette = getBadgeTierPalette(tier);
    const isCurrentTier = completedCount >= segmentStart && completedCount < segmentStart + 5;
    const isCompletedTier = completedCount >= segmentStart + 5;
    return {
      tier,
      tierPalette,
      completed: segmentCompleted,
      progressWidth: `${(segmentCompleted / 5) * 100}%` as `${number}%`,
      isCurrentTier,
      isCompletedTier,
    };
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.sectionHeader, styles.centeredHeader]}>
        <Text style={styles.sectionTitle}>{s('challengeBadgeProgression')}</Text>
        <Text style={styles.sectionCopy}>{s('challengeBadgeProgressionDesc')}</Text>
      </View>
      {renderMonthlyMastery()}

      <View style={[styles.badgeFeature, { borderColor: activeBadge.color }]}>
        <View style={styles.badgeFeatureTop}>
          <View style={[styles.badgeFeatureIcon, { backgroundColor: activeBadge.color }]}>
            <View style={styles.badgeFeatureIconHalo} />
            <BadgeTrackIcon
              badge={activeBadge}
              size={64}
              variant="feature"
              fallbackColor={colors.textOnPrimary}
            />
          </View>
          <View style={styles.badgeFeatureCopy}>
            <Text style={styles.eyebrow}>{s('challengeNextBadge')}</Text>
            <Text style={styles.badgeFeatureTitle}>{trackName()}</Text>
            <Text style={styles.badgeFeatureDesc}>{trackDescription()}</Text>
          </View>
          <View style={[styles.badgeFeatureCount, { backgroundColor: activeBadge.paleColor }]}>
            <Text style={[styles.badgeFeatureCountText, { color: activeBadge.color }]}>{completedCount}/15</Text>
          </View>
        </View>
        <View style={styles.badgeTierProgressPanel}>
          {tierSegments.map(({ tier, tierPalette, completed, progressWidth, isCurrentTier, isCompletedTier }) => (
            <View
              key={tier}
              style={[
                styles.badgeTierProgressRow,
                {
                  borderColor: tierPalette.border,
                  backgroundColor: tierPalette.surface,
                },
              ]}
            >
              <View style={[styles.badgeTierProgressIcon, { backgroundColor: tierPalette.iconSurface }]}>
                <Lucide name="flame" size={18} color={tierPalette.iconForeground} />
              </View>
              <View style={styles.badgeTierProgressBody}>
                <View style={styles.badgeTierProgressHeader}>
                  <Text style={[styles.badgeTierProgressLabel, { color: tierPalette.accent }]}>{tierLabel(tier)}</Text>
                  <Text style={[styles.badgeTierProgressCount, { color: tierPalette.accent }]}>{completed}/5</Text>
                </View>
                <View style={styles.badgeTierProgressTrack}>
                  <View
                    style={[
                      styles.badgeTierProgressFill,
                      {
                        width: progressWidth,
                        backgroundColor: tierPalette.iconSurface,
                        opacity: isCurrentTier || isCompletedTier ? 1 : 0.88,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{s('challengeBadgesWon')}</Text>
        <Text style={styles.sectionCopy}>{s('challengeBadgesWonDesc')}</Text>
      </View>
      {wonBadges.length > 0 ? (
        <View style={styles.wonGrid}>
          {wonBadges.map(({ badge, tier, earnedAt }) => (
            <EarnedBadgeCard
              key={`${badge.id}-${tier}`}
              badge={badge}
              tier={tier}
              earnedAt={earnedAt}
              isLatest={`${badge.category}:${tier}` === latestEarnedBadgeKey}
              styles={styles}
              colors={colors}
              tierLabel={tierLabel}
              trackName={trackName}
              s={s}
              lang={lang}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyPanel}>
          <Lucide name="award" size={24} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>{s('challengeNoBadgesWon')}</Text>
          <Text style={styles.emptyText}>{s('challengeNoBadgesWonDesc')}</Text>
        </View>
      )}
    </ScrollView>
  );
}
