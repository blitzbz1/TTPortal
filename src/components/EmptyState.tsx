import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, Radius, Shadows } from '../theme';

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
      <View style={[styles.iconWrap, iconBg ? { backgroundColor: iconBg } : null]}>
        <Lucide name={icon} size={32} color={iconColor || colors.textFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <TouchableOpacity style={styles.cta} onPress={onCtaPress} testID="empty-state-cta">
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
      paddingHorizontal: 32,
      gap: 12,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    description: {
      fontFamily: Fonts.body,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    cta: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 10,
      paddingHorizontal: 24,
      marginTop: 4,
      ...Shadows.sm,
    },
    ctaText: {
      fontFamily: Fonts.body,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
  });
}
