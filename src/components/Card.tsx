import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { Shadows, Radius } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: 'sm' | 'md' | 'lg';
  borderRadius?: number;
}

export function Card({ children, style, shadow = 'sm', borderRadius = Radius.lg }: CardProps) {
  const { colors } = useTheme();

  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, Shadows[shadow], style]}>
      {/* Outer stroke gradient — creates beveled edge */}
      <LinearGradient
        colors={[colors.strokeGradientStart, colors.strokeGradientEnd]}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
      {/* Inner surface gradient — 1px offset creates the border */}
      <LinearGradient
        colors={[colors.surfaceGradientStart, colors.surfaceGradientEnd]}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: Math.max(0, borderRadius - 1), margin: 1 },
        ]}
      />
      {children}
    </View>
  );
}
