// F030: a tiny rating-over-time sparkline rendered with react-native-svg
// (already a dependency). Takes the last ~30 rating points (oldest → newest).
import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

interface Props {
  points: number[];
  width?: number;
  height?: number;
}

export function RatingSparkline({ points, width = 220, height = 44 }: Props) {
  const { colors } = useTheme();
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + innerH - ((p - min) / range) * innerH; // higher rating → higher on screen
    return { x, y };
  });
  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  const up = points[points.length - 1] >= points[0];
  const stroke = up ? colors.primary : colors.red;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Polyline points={polyline} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={last.x} cy={last.y} r={3} fill={stroke} />
      </Svg>
    </View>
  );
}
