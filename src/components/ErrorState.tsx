import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Shadows, Spacing } from '../theme';

interface ErrorStateProps {
  title: string;
  description?: string;
  ctaLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, ctaLabel, onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container} testID="error-state">
      <View style={styles.iconWrap}>
        <Lucide name="alert-triangle" size={28} color={colors.red} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {ctaLabel && onRetry ? (
        <TouchableOpacity style={styles.cta} onPress={onRetry} testID="error-state-cta">
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.sm,
    },
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.redPale,
      borderWidth: 1,
      borderColor: colors.redBorder,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    description: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textMuted,
      lineHeight: 18,
      textAlign: 'center',
    },
    cta: {
      marginTop: Spacing.xxs,
      borderRadius: Radius.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 10,
      ...Shadows.sm,
    },
    ctaText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
  });
}
