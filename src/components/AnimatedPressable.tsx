import React from 'react';
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Duration, Springs } from '../lib/motion';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale factor when pressed (default 0.97) */
  scaleDown?: number;
}

export function AnimatedPressable({
  style,
  scaleDown = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: AnimatedPressableProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        if (!reduced) {
          scale.value = withTiming(scaleDown, {
            duration: Duration.instant,
            easing: Easing.out(Easing.cubic),
          });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, Springs.snappy);
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
