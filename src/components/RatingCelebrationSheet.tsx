// F030: a celebration sheet shown when the player's rating goes up after a
// match is confirmed. Renders a shareable ShareCard.
import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from './Icon';
import { shareCardImage } from '../lib/shareImage';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';

interface Props {
  visible: boolean;
  rating: number;
  delta: number;
  peak: number;
  matches: number;
  onClose: () => void;
}

export function RatingCelebrationSheet({ visible, rating, delta, peak, matches, onClose }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const cardRef = useRef<View>(null);
  const roundedRating = Math.round(rating);
  const roundedPeak = Math.round(peak);
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.wrap} onPress={() => {}}>
          <View
            ref={cardRef}
            collapsable={false}
            style={styles.card}
          >
            <View style={styles.brandPill}>
              <Lucide name="circle-dot" size={14} color={colors.primary} />
              <Text style={styles.brandText}>TTPortal</Text>
            </View>
            <View style={styles.iconTile}>
              <Lucide name="trending-up" size={48} color={colors.primary} />
            </View>
            <Text style={styles.title}>{s('ratingCelebrationTitle')}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.rating}>{roundedRating}</Text>
              <View style={styles.deltaPill}>
                <Lucide name={delta >= 0 ? 'arrow-up-right' : 'arrow-down-right'} size={15} color={delta >= 0 ? colors.primary : colors.red} />
                <Text style={[styles.deltaText, { color: delta >= 0 ? colors.primary : colors.red }]}>
                  {deltaText}
                </Text>
              </View>
            </View>
            <Text style={styles.copy}>
              {delta > 0 ? s('ratingCelebrationUp', deltaText) : s('ratingProvisional')}
            </Text>
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
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>{s('close')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => shareCardImage(cardRef, s('ratingCelebrationShareMessage'))}
              accessibilityRole="button"
            >
              <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
              <Text style={styles.shareText}>{s('shareCard')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    wrap: {
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      gap: Spacing.md,
    },
    card: {
      width: '100%',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: colors.bgAlt,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      padding: Spacing.xl,
      ...Shadows.lg,
    },
    brandPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      backgroundColor: colors.primaryPale,
      paddingVertical: 5,
      paddingHorizontal: 9,
    },
    brandText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      color: colors.primary,
    },
    iconTile: {
      width: 96,
      height: 96,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primaryDim,
      ...Shadows.md,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.display,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    rating: {
      fontFamily: Fonts.heading,
      fontSize: 56,
      lineHeight: 62,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    deltaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgMuted,
      paddingVertical: 5,
      paddingHorizontal: 9,
    },
    deltaText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
    },
    copy: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    stats: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.sm,
      backgroundColor: colors.bgMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: Spacing.sm,
      marginTop: Spacing.xs,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.borderLight,
    },
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
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    shareBtn: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: colors.primary,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      ...Shadows.sm,
    },
    shareText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.textOnPrimary,
      textAlign: 'center',
    },
    closeBtn: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
    },
    closeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
  });
}
