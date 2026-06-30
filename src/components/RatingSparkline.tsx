// F030: a tiny rating-over-time sparkline rendered with react-native-svg.
// Takes the last ~30 rating points, oldest to newest.
import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
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
  const flat = max === min;
  const range = max - min || 1;
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = flat ? pad + innerH / 2 : pad + innerH - ((p - min) / range) * innerH; // higher rating -> higher on screen
    return { x, y };
  });
  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  const up = points[points.length - 1] >= points[0];
  const stroke = flat ? colors.textMuted : up ? colors.primary : colors.red;
  const guideY = pad + innerH / 2;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Line
          x1={pad}
          y1={guideY}
          x2={width - pad}
          y2={guideY}
          stroke={colors.borderLight}
          strokeWidth={1}
          strokeDasharray="3 5"
        />
        <Polyline
          points={polyline}
          fill="none"
          stroke={stroke}
          strokeWidth={flat ? 1.8 : 2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={flat ? 0.72 : 1}
        />
        {!flat ? <Circle cx={last.x} cy={last.y} r={3} fill={stroke} /> : null}
      </Svg>
    </View>
  );
}

