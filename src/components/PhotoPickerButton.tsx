import React, { useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';

export type PhotoPickerButtonProps = {
  /** Currently selected photo URI (local or remote), or null for the empty state. */
  photoUri: string | null;
  onPress: () => void;
  /** Label shown when no photo is selected. */
  addLabel: string;
  /** Label shown once a photo is selected (tap to replace it). */
  changeLabel: string;
  testID?: string;
};

/**
 * Compact dashed-border photo picker: a camera icon + label when empty, or a
 * 48px thumbnail + "change" label once a photo is chosen. Shared by the
 * condition-vote and change-request flows so both look identical. Presentational
 * only — the caller owns the picker logic and what happens to the result.
 */
export function PhotoPickerButton({
  photoUri,
  onPress,
  addLabel,
  changeLabel,
  testID,
}: PhotoPickerButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.photoBtn} onPress={onPress} testID={testID}>
      {photoUri ? (
        <Image source={photoUri} style={styles.thumb} cachePolicy="memory-disk" contentFit="cover" />
      ) : (
        <Lucide name="camera" size={20} color={colors.textFaint} />
      )}
      <Text style={styles.photoBtnText}>{photoUri ? changeLabel : addLabel}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    photoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      height: 60,
      gap: Spacing.xs,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      ...Shadows.sm,
    },
    photoBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      color: colors.textFaint,
    },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 8,
    },
  });
}
