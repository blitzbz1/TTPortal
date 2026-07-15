import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lucide } from './Icon';
import { useI18n } from '../hooks/useI18n';
import { useTheme } from '../hooks/useTheme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing, type ThemeColors } from '../theme';
import type { DominantHand, EquipmentSelection, Grip, PlayingStyle, RubberColor } from '../types/database';

type EquipmentSummaryVariant = 'owner' | 'profile' | 'history';

interface EquipmentSummaryCardProps {
  equipment: EquipmentSelection;
  title: string;
  variant: EquipmentSummaryVariant;
  savedAt?: string;
}

const COLOR_SWATCHES: Record<RubberColor, string> = {
  red: '#ef4444',
  black: '#0f172a',
  pink: '#ec4899',
  blue: '#2563eb',
  purple: '#7c3aed',
  green: '#16a34a',
};

function handIcon(value: DominantHand) {
  return value === 'left' ? 'hand' : 'hand';
}

function styleIcon(value: PlayingStyle) {
  if (value === 'defender') return 'shield';
  if (value === 'all_rounder') return 'activity';
  return 'zap';
}

function gripIcon(value: Grip) {
  if (value === 'penhold') return 'grip';
  if (value === 'other') return 'badge';
  return 'handshake';
}

export function EquipmentSummaryCard({ equipment, title, variant, savedAt }: EquipmentSummaryCardProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const quiet = variant === 'history';

  const handLabel = equipment.dominant_hand === 'left' ? s('equipmentHandLeft') : s('equipmentHandRight');
  const styleLabel =
    equipment.playing_style === 'defender'
      ? s('equipmentStyleDefender')
      : equipment.playing_style === 'all_rounder'
        ? s('equipmentStyleAllRounder')
        : s('equipmentStyleAttacker');
  const gripLabel =
    equipment.grip === 'penhold'
      ? s('equipmentGripPenhold')
      : equipment.grip === 'other'
        ? s('equipmentGripOther')
        : s('equipmentGripShakehand');

  const renderRubberRow = (
    sideLabel: string,
    manufacturer: string,
    model: string,
    color: RubberColor,
  ) => (
    <View style={styles.rubberRow}>
      <View style={[styles.colorDot, { backgroundColor: COLOR_SWATCHES[color] }]} />
      <View style={styles.rubberCopy}>
        <View style={styles.rubberHeader}>
          <Text style={styles.rubberLabel}>{sideLabel}</Text>
          <Text style={styles.colorLabel}>{s(`equipmentColor_${color}`)}</Text>
        </View>
        <Text style={styles.rubberValue} numberOfLines={1}>{manufacturer} {model}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.card, quiet && styles.cardQuiet]}>
      <View style={styles.header}>
        <Text style={[styles.title, quiet && styles.titleQuiet]} numberOfLines={1}>{title}</Text>
        {savedAt ? <Text style={styles.savedAt} numberOfLines={1}>{savedAt}</Text> : null}
      </View>

      <View style={styles.bladeRow}>
        <View style={styles.bladeIcon}>
          <Lucide name="scan-line" size={17} color={colors.primary} />
        </View>
        <View style={styles.bladeCopy}>
          <Text style={styles.bladeLabel}>{s('equipmentBlade')}</Text>
          <Text style={styles.bladeValue} numberOfLines={1}>
            {equipment.blade_manufacturer} {equipment.blade_model}
          </Text>
        </View>
      </View>

      <View style={styles.rubberStack}>
        {renderRubberRow(
          s('equipmentForehand'),
          equipment.forehand_rubber_manufacturer,
          equipment.forehand_rubber_model,
          equipment.forehand_rubber_color,
        )}
        {renderRubberRow(
          s('equipmentBackhand'),
          equipment.backhand_rubber_manufacturer,
          equipment.backhand_rubber_model,
          equipment.backhand_rubber_color,
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Lucide name={handIcon(equipment.dominant_hand)} size={13} color={colors.primaryMid} />
          <Text style={styles.metaText}>{handLabel}</Text>
        </View>
        <View style={styles.metaPill}>
          <Lucide name={styleIcon(equipment.playing_style)} size={13} color={colors.primaryMid} />
          <Text style={styles.metaText}>{styleLabel}</Text>
        </View>
        <View style={styles.metaPill}>
          <Lucide name={gripIcon(equipment.grip)} size={13} color={colors.primaryMid} />
          <Text style={styles.metaText}>{gripLabel}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: Spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgAlt,
      padding: Spacing.md,
      ...Shadows.sm,
    },
    cardQuiet: {
      shadowOpacity: 0.04,
    },
    header: {
      gap: 2,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    titleQuiet: {
      fontSize: FontSize.lg,
      color: colors.textMuted,
    },
    savedAt: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: colors.textFaint,
    },
    bladeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgMuted,
      padding: Spacing.sm,
    },
    bladeIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primaryDim,
      backgroundColor: colors.primaryPale,
    },
    bladeCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    bladeLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    bladeValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    rubberStack: {
      gap: 8,
    },
    rubberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bg,
      padding: Spacing.sm,
    },
    colorDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rubberCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rubberHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    rubberLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    colorLabel: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      color: colors.textFaint,
    },
    rubberValue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.bgMuted,
      paddingVertical: 6,
      paddingHorizontal: 9,
    },
    metaText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
