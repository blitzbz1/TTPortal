import React, { useCallback, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { Radius } from '../theme';
import { hapticMedium } from '../lib/haptics';

const DELETE_ACTION_WIDTH = 80;

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
}

export function SwipeableDeleteRow({ children, onDelete }: Props) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const isDeletingRef = useRef(false);

  const handleDeletePress = useCallback(() => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    swipeableRef.current?.close();
    onDelete();
  }, [onDelete]);

  const renderRightActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>) => {
      const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [DELETE_ACTION_WIDTH, 0],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View style={[styles.actionContainer, { transform: [{ translateX }] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete notification"
            onPress={handleDeletePress}
            style={[styles.button, { backgroundColor: colors.red }]}
          >
            <Lucide name="trash-2" size={20} color={colors.textOnPrimary} />
          </Pressable>
        </Animated.View>
      );
    },
    [colors.red, colors.textOnPrimary, handleDeletePress],
  );

  if (Platform.OS === 'web') {
    return <View>{children}</View>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      overshootRight={false}
      rightThreshold={40}
      onSwipeableWillOpen={hapticMedium}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionContainer: {
    width: DELETE_ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
  },
});
