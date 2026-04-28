import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { BadgeTrackIcon } from '../../components/BadgeTrackIcon';
import { Lucide } from '../../components/Icon';
import type { ThemeColors } from '../../theme';
import type { BadgeTier, BadgeTrack } from '../../lib/badgeChallenges';
import { TIER_TARGETS, getBadgeTierPalette } from '../../lib/badgeChallenges';
import type { createStyles } from '../ChallengeScreen.styles';

export function formatEarnedMonth(value: string | null | undefined, lang: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-US', {
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  badge: BadgeTrack;
  tier: BadgeTier;
  earnedAt: string;
  isLatest: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  tierLabel: (tier: BadgeTier) => string;
  trackName: (badge: BadgeTrack) => string;
  s: (key: string, ...args: string[]) => string;
  lang: string;
}

export function EarnedBadgeCard({
  badge,
  tier,
  earnedAt,
  isLatest,
  styles,
  colors,
  tierLabel,
  trackName,
  s,
  lang,
}: Props) {
  const scale = useRef(new Animated.Value(isLatest ? 0.94 : 1)).current;
  const opacity = useRef(new Animated.Value(isLatest ? 0 : 1)).current;
  const tierPalette = getBadgeTierPalette(tier);

  useEffect(() => {
    if (!isLatest) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 105,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLatest, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.wonCard,
        {
          backgroundColor: tierPalette.surface,
          borderColor: isLatest ? badge.color : tierPalette.border,
        },
        { opacity, transform: [{ scale }] },
      ]}
    >
      <View style={[styles.wonIcon, { backgroundColor: tierPalette.iconSurface }]}>
        <View style={styles.wonIconHalo} />
        <BadgeTrackIcon
          badge={badge}
          size={64}
          variant="earned"
          fallbackColor={colors.textOnPrimary}
        />
        <View style={[styles.wonTierSeal, { backgroundColor: tierPalette.accent, borderColor: tierPalette.border }]}>
          <Lucide name="medal" size={12} color={tierPalette.iconForeground} />
        </View>
      </View>
      <View style={styles.wonCopy}>
        <View style={styles.wonTitleRow}>
          <Text style={[styles.wonTitle, { color: tierPalette.accent }]}>{tierLabel(tier)} {trackName(badge)}</Text>
          {isLatest ? (
            <View style={[styles.newBadgePill, { backgroundColor: badge.paleColor }]}>
              <Text style={[styles.newBadgePillText, { color: badge.color }]}>{s('newBadge')}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.wonDateRow}>
          <Lucide name="calendar-check" size={13} color={tierPalette.accent} />
          <Text style={[styles.wonMeta, { color: tierPalette.accent }]}>{s('challengeEarnedMonth', formatEarnedMonth(earnedAt, lang))}</Text>
        </View>
        <Text style={[styles.wonSubMeta, { color: tierPalette.accent }]}>{s('challengeCompletedCount', String(TIER_TARGETS[tier]))}</Text>
      </View>
    </Animated.View>
  );
}
