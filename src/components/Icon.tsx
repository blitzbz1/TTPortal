import React from 'react';
import { View } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { Colors } from '../theme';

interface LucideProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Convert a kebab-case icon name (e.g. "arrow-left") to
 * the PascalCase key used by lucide-react-native (e.g. "ArrowLeft").
 */
function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

export function Lucide({ name, size = 24, color = Colors.ink, strokeWidth }: LucideProps) {
  const key = toPascalCase(name);
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<LucideIcons.LucideProps>>)[key];

  if (!IconComponent) {
    return <View style={{ width: size, height: size }} />;
  }

  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
