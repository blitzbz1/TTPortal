import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme';

/**
 * Placeholder icon component.
 * Replace with actual lucide-react-native icons in production:
 *
 *   import { Map, Calendar, Trophy, Heart, User, ... } from 'lucide-react-native';
 *
 * This stub renders a colored square so screens lay out correctly
 * before the icon library is installed.
 */

interface LucideProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Lucide({ size = 24, color = Colors.ink }: LucideProps) {
  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: color + '22',
          borderColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderWidth: 1.5,
  },
});
