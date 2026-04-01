import React, { useRef, useMemo } from 'react';
import { View, Animated, PanResponder, Dimensions, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Spacing, Shadows } from '../theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAP_TOP = SCREEN_HEIGHT * 0.1;    // full-screen (90% visible)
const SNAP_MID = SCREEN_HEIGHT * 0.5;    // half-screen
const SNAP_BOTTOM = SCREEN_HEIGHT * 0.72; // peek (28% visible)

interface DraggableSheetProps {
  children: React.ReactNode;
  /** Content rendered floating above the sheet top edge, moves with the sheet */
  floatingContent?: React.ReactNode;
}

export function DraggableSheet({ children, floatingContent }: DraggableSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const translateY = useRef(new Animated.Value(SNAP_MID)).current;
  const lastSnap = useRef(SNAP_MID);

  const snapTo = (value: number) => {
    lastSnap.current = value;
    Animated.spring(translateY, {
      toValue: value,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const newY = lastSnap.current + g.dy;
        const clamped = Math.max(SNAP_TOP, Math.min(SNAP_BOTTOM, newY));
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const currentY = lastSnap.current + g.dy;
        const velocity = g.vy;

        // Determine which snap point to use based on position and velocity
        if (velocity < -0.5) {
          // Swiping up fast
          if (currentY > SNAP_MID) snapTo(SNAP_MID);
          else snapTo(SNAP_TOP);
        } else if (velocity > 0.5) {
          // Swiping down fast
          if (currentY < SNAP_MID) snapTo(SNAP_MID);
          else snapTo(SNAP_BOTTOM);
        } else {
          // Settle to nearest snap point
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

  return (
    <Animated.View
      style={[styles.sheet, { transform: [{ translateY }] }]}
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
