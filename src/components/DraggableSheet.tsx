import React, { useRef, useMemo } from 'react';
import { View, PanResponder, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Shadows } from '../theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAP_TOP = SCREEN_HEIGHT * 0.1;    // full-screen (90% visible)
const SNAP_MID = SCREEN_HEIGHT * 0.5;    // half-screen
const SNAP_BOTTOM = SCREEN_HEIGHT * 0.72; // peek (28% visible)

const SNAP_SPRING = { damping: 28, stiffness: 300, mass: 0.8 };

interface DraggableSheetProps {
  children: React.ReactNode;
  /** Content rendered floating above the sheet top edge, moves with the sheet */
  floatingContent?: React.ReactNode;
}

export function DraggableSheet({ children, floatingContent }: DraggableSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const translateY = useSharedValue(SNAP_MID);
  const lastSnap = useRef(SNAP_MID);

  const snapTo = (value: number) => {
    lastSnap.current = value;
    translateY.value = withSpring(value, SNAP_SPRING);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const newY = lastSnap.current + g.dy;
        translateY.value = Math.max(SNAP_TOP, Math.min(SNAP_BOTTOM, newY));
      },
      onPanResponderRelease: (_, g) => {
        const currentY = lastSnap.current + g.dy;
        const velocity = g.vy;

        if (velocity < -0.5) {
          if (currentY > SNAP_MID) snapTo(SNAP_MID);
          else snapTo(SNAP_TOP);
        } else if (velocity > 0.5) {
          if (currentY < SNAP_MID) snapTo(SNAP_MID);
          else snapTo(SNAP_BOTTOM);
        } else {
          const distTop = Math.abs(currentY - SNAP_TOP);
          const distMid = Math.abs(currentY - SNAP_MID);
          const distBot = Math.abs(currentY - SNAP_BOTTOM);
          const min = Math.min(distTop, distMid, distBot);
          if (min === distTop) snapTo(SNAP_TOP);
          else if (min === distMid) snapTo(SNAP_MID);
          else snapTo(SNAP_BOTTOM);
        }
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.sheet, sheetStyle]}
      testID="draggable-sheet"
    >
      {floatingContent && (
        <View style={styles.floating} pointerEvents="box-none">
          {floatingContent}
        </View>
      )}
      <View style={styles.handleArea} {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: SCREEN_HEIGHT,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'visible',
      ...Shadows.lg,
    },
    floating: {
      position: 'absolute',
      top: -58,
      right: 14,
      zIndex: 10,
    },
    handleArea: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    content: {
      flex: 1,
    },
  });
}
