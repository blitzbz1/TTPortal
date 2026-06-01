import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { BounceIn, FadeInUp } from 'react-native-reanimated';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius, Shadows, FontSize, FontWeight, Spacing } from '../theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  iconColor?: string;
  iconBg?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCtaPress,
  iconColor,
  iconBg,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container} testID="empty-state">
      <Animated.View entering={BounceIn.duration(600).delay(100)} style={[styles.iconWrap, iconBg ? { backgroundColor: iconBg } : null]}>
        <Lucide name={icon} size={32} color={iconColor || colors.textFaint} />
      </Animated.View>
      <Animated.View entering={FadeInUp.duration(350).delay(350)}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </Animated.View>
      {ctaLabel && onCtaPress ? (
        <Animated.View entering={FadeInUp.duration(350).delay(500)}>
          <TouchableOpacity style={styles.cta} onPress={onCtaPress} testID="empty-state-cta">
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
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
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xxs,
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
      textAlign: 'center',
      lineHeight: 18,
      marginTop: Spacing.xxs,
    },
    cta: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 10,
      paddingHorizontal: Spacing.xl,
      marginTop: Spacing.xxs,
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
