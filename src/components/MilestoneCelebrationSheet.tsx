// F053: one consistent award modal for every lifetime milestone. The caller
// owns stacking (for example, after check-in success); this component owns the
// shared award presentation, haptic, dismissal, and share behavior.
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { AwardCelebrationModal } from './AwardCelebrationModal';
import { Lucide } from './Icon';
import { shareAward } from '../lib/awardShare';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { useAppShare } from '../contexts/ShareProvider';
import type { ThemeColors } from '../theme';
import { MILESTONE_DEF_BY_KEY, type MilestoneMetric } from '../features/milestones';

interface Props {
  visible: boolean;
  /** The just-crossed milestone key (matches MILESTONE_DEF_BY_KEY). */
  milestoneKey: string | null;
  /** Durable context link used by web sharing and native capture fallback. */
  shareUrl: string;
  onClose: () => void;
}

interface MilestonePalette {
  accent: string;
  surface: string;
  border: string;
}

function getMilestonePalette(metric: MilestoneMetric, colors: ThemeColors): MilestonePalette {
  switch (metric) {
    case 'venues':
      return { accent: '#C2410C', surface: colors.amberPale, border: colors.amberDeep };
    case 'hours':
      return { accent: '#1E40AF', surface: colors.bluePale, border: colors.blue };
    case 'anniversary':
      return { accent: '#6D28D9', surface: colors.purplePale, border: colors.purpleDim };
    case 'reviews':
      return { accent: '#C2410C', surface: colors.amberPale, border: colors.amberDeep };
    case 'checkins':
    default:
      return { accent: '#15803D', surface: colors.primaryPale, border: colors.primaryDim };
  }
}

export function MilestoneCelebrationSheet({ visible, milestoneKey, shareUrl, onClose }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const { share } = useAppShare();
  const captureRef = useRef<View>(null);
  const def = milestoneKey ? MILESTONE_DEF_BY_KEY[milestoneKey] : null;
  const palette = useMemo(
    () => (def ? getMilestonePalette(def.metric, colors) : null),
    [colors, def],
  );

  if (!visible || !def || !palette) return null;
  const awardName = s(def.titleKey);

  return (
    <AwardCelebrationModal
      visible
      title={s('milestoneCelebrationTitle')}
      awardName={awardName}
      description={s('milestoneCelebrationSubtitle')}
      accent={palette.accent}
      accentSurface={palette.surface}
      accentBorder={palette.border}
      visual={<Lucide name={def.icon} size={48} color={colors.textOnPrimary} />}
      dismissLabel={s('close')}
      shareLabel={s('milestoneShare')}
      onDismiss={onClose}
      onShare={() => shareAward({
        cardRef: captureRef,
        message: s('milestoneShareMessage', awardName),
        title: awardName,
        url: shareUrl,
        share,
      })}
      testID="milestone-celebration"
      dismissTestID="milestone-close"
      shareTestID="milestone-share"
      captureRef={captureRef}
    />
  );
}
