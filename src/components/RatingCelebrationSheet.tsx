// F030: rating awards use the same presentation and sharing contract as badge
// tiers and lifetime milestones.
import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AwardCelebrationModal } from './AwardCelebrationModal';
import { Lucide } from './Icon';
import { useAppShare } from '../contexts/ShareProvider';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { shareAward } from '../lib/awardShare';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';

interface Props {
  visible: boolean;
  rating: number;
  delta: number;
  peak: number;
  matches: number;
  shareUrl: string;
  onClose: () => void;
}

export function RatingCelebrationSheet({ visible, rating, delta, peak, matches, shareUrl, onClose }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const { share } = useAppShare();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const captureRef = useRef<View>(null);
  const roundedRating = Math.round(rating);
  const roundedPeak = Math.round(peak);
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
  const accent = '#15803D';

  return (
    <AwardCelebrationModal
      visible={visible}
      title={s('ratingCelebrationTitle')}
      awardName={`${roundedRating}  ${deltaText}`}
      description={delta > 0 ? s('ratingCelebrationUp', deltaText) : s('ratingProvisional')}
      accent={accent}
      accentSurface={colors.primaryPale}
      accentBorder={colors.primaryDim}
      visual={<Lucide name="trending-up" size={48} color={colors.textOnPrimary} />}
      details={(
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{roundedPeak}</Text>
            <Text style={styles.statLabel}>{s('ratingPeak')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{matches}</Text>
            <Text style={styles.statLabel}>{s('ratingMatches')}</Text>
          </View>
        </View>
      )}
      dismissLabel={s('close')}
      shareLabel={s('shareCard')}
      onDismiss={onClose}
      onShare={() => shareAward({
        cardRef: captureRef,
        message: s('ratingCelebrationShareMessage'),
        title: s('ratingCelebrationTitle'),
        url: shareUrl,
        share,
      })}
      testID="rating-celebration"
      dismissTestID="rating-close"
      shareTestID="rating-share"
      captureRef={captureRef}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stats: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: Spacing.sm,
      marginTop: Spacing.xs,
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderLight },
    statValue: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    statLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textMuted,
    },
  });
}
