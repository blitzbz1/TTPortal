import React from 'react';
import { BadgeTrackIcon } from '../../components/BadgeTrackIcon';
import { AwardCelebrationModal } from '../../components/AwardCelebrationModal';
import type { ThemeColors } from '../../theme';
import type { BadgeTier, BadgeTrack } from '../../features/challenges/badgeDefinitions';
import { getBadgeTierPalette } from '../../features/challenges/badgeDefinitions';

interface Props {
  data: { badge: BadgeTrack; tier: BadgeTier } | null;
  colors: ThemeColors;
  tierLabel: (tier: BadgeTier) => string;
  trackName: (badge: BadgeTrack) => string;
  s: (key: string, ...args: string[]) => string;
  onDismiss: () => void;
  onShare: () => void;
}

export function EarnedBadgeModal(props: Props) {
  const { data, colors, tierLabel, trackName, s, onDismiss, onShare } = props;
  const tierPalette = data ? getBadgeTierPalette(data.tier) : null;

  if (!data || !tierPalette) return null;

  return (
    <AwardCelebrationModal
      visible
      title={tierLabel(data.tier)}
      awardName={trackName(data.badge)}
      description={s('challengeBadgeUnlockedDesc')}
      accent={data.badge.color}
      accentSurface={tierPalette.surface}
      accentBorder={tierPalette.border}
      visual={(
        <BadgeTrackIcon
          badge={data.badge}
          size={64}
          variant="modal"
          fallbackColor={colors.textOnPrimary}
        />
      )}
      dismissLabel={s('challengeKeepPlaying')}
      shareLabel={s('challengeShareBadge')}
      onDismiss={onDismiss}
      onShare={onShare}
      testID="badge-earned-modal"
      dismissTestID="badge-earned-dismiss"
      shareTestID="badge-earned-share"
    />
  );
}
