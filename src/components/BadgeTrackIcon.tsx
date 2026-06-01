import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import type { BadgeTrack } from '../lib/badgeChallenges';
import { Lucide } from './Icon';

type BadgeTrackIconVariant = 'picker' | 'hero' | 'feature' | 'earned' | 'modal' | 'challenge-card';

interface BadgeTrackIconProps {
  badge: BadgeTrack;
  size: number;
  fallbackColor: string;
  variant?: BadgeTrackIconVariant;
}

const BADGE_TRACK_ICON_SOURCES: Partial<Record<BadgeTrack['id'], ImageSourcePropType>> = {
  'craft-player': require('../../assets/badge-track-icons/craft.png'),
  'spin-artist': require('../../assets/badge-track-icons/spin-artist.png'),
  'first-attack': require('../../assets/badge-track-icons/first-attack.png'),
  'footwork-engine': require('../../assets/badge-track-icons/footwork-engine.png'),
  'table-guardian': require('../../assets/badge-track-icons/table-guardian.png'),
  'serve-lab': require('../../assets/badge-track-icons/serve-lab.png'),
  competitor: require('../../assets/badge-track-icons/competitor.png'),
  explorer: require('../../assets/badge-track-icons/explorer.png'),
};

const BADGE_TRACK_ICON_TUNING: Record<BadgeTrack['id'], { scale: number }> = {
  'craft-player': { scale: 1.02 },
  'spin-artist': { scale: 1.06 },
  'first-attack': { scale: 1.05 },
  'footwork-engine': { scale: 1.01 },
  'table-guardian': { scale: 1.01 },
  'serve-lab': { scale: 1.05 },
  competitor: { scale: 1.02 },
  explorer: { scale: 1.03 },
};

const VARIANT_SCALE: Record<BadgeTrackIconVariant, number> = {
  picker: 1,
  hero: 1,
  feature: 1,
  earned: 1,
  modal: 1.04,
  'challenge-card': 1,
};

export function BadgeTrackIcon({
  badge,
  size,
  fallbackColor,
  variant = 'hero',
}: BadgeTrackIconProps) {
  const source = BADGE_TRACK_ICON_SOURCES[badge.id];
  if (!source) {
    return <Lucide name={badge.icon} size={size} color={fallbackColor} />;
  }

  const tuning = BADGE_TRACK_ICON_TUNING[badge.id] ?? { scale: 1 };
  const visualScale = tuning.scale * VARIANT_SCALE[variant];

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
        transform: [{ scale: visualScale }],
      }}
    />
  );
}
