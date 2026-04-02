import React, { useMemo, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { useSession } from '../hooks/useSession';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { hapticSelection } from '../lib/haptics';
import { Springs, Duration } from '../lib/motion';

export type TabKey = 'map' | 'events' | 'leaderboard' | 'favorites' | 'profile';

const AUTH_ONLY_TABS: Set<TabKey> = new Set(['leaderboard', 'favorites', 'profile']);

interface TabBarProps {
  activeTab: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

/* ── Individual tab item (hooks must live in a component, not .map) ── */

interface TabItemProps {
  tabKey: TabKey;
  icon: string;
  label: string;
  isActive: boolean;
  isFirst: boolean;
  reduced: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onLayout?: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}

function TabItem({ icon, label, isActive, reduced, colors, styles, onLayout, onPress }: TabItemProps) {
  const scale = useSharedValue(1);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    alignItems: 'center' as const,
  }));

  const handlePress = () => {
    if (!reduced) {
      scale.value = withSpring(1.15, Springs.bouncy);
      setTimeout(() => {
        scale.value = withSpring(1, Springs.gentle);
      }, Duration.fast);
    }
    hapticSelection();
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.tab}
      onLayout={onLayout}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View style={iconStyle}>
        <Lucide
          name={icon}
          size={22}
          color={isActive ? colors.primary : colors.textFaint}
        />
        <Text style={[styles.label, isActive && styles.labelActive]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ── Tab bar ── */

export function TabBar({ activeTab, onTabPress }: TabBarProps) {
  const { s } = useI18n();
  const { session } = useSession();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const TABS = useMemo(() => {
    const all: { key: TabKey; icon: string; label: string }[] = [
      { key: 'map', icon: 'map', label: s('tabMap') },
      { key: 'events', icon: 'calendar', label: s('tabEvents') },
      { key: 'leaderboard', icon: 'trophy', label: s('tabLeaderboard') },
      { key: 'favorites', icon: 'heart', label: s('tabFavorites') },
    ];
    return session ? all : all.filter((t) => !AUTH_ONLY_TABS.has(t.key));
  }, [session, s]);

  // Indicator position
  const indicatorX = useSharedValue(0);
  const tabWidth = useSharedValue(0);

  const activeIndex = TABS.findIndex((t) => t.key === activeTab);

  useEffect(() => {
    if (tabWidth.value > 0) {
      indicatorX.value = reduced
        ? activeIndex * tabWidth.value
        : withSpring(activeIndex * tabWidth.value, Springs.snappy);
    }
  }, [activeIndex, tabWidth.value, reduced, indicatorX]);

  const onTabLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      tabWidth.value = w;
      indicatorX.value = activeIndex * w;
    },
    [activeIndex, tabWidth, indicatorX],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: tabWidth.value,
  }));

  return (
    <View style={styles.container}>
      {/* Sliding indicator */}
      <Animated.View style={[styles.indicator, { backgroundColor: colors.primary }, indicatorStyle]} />

      {TABS.map((tab, index) => (
        <TabItem
          key={tab.key}
          tabKey={tab.key}
          icon={tab.icon}
          label={tab.label}
          isActive={activeTab === tab.key}
          isFirst={index === 0}
          reduced={reduced}
          colors={colors}
          styles={styles}
          onLayout={index === 0 ? onTabLayout : undefined}
          onPress={() => onTabPress?.(tab.key)}
        />
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      height: 56,
      backgroundColor: colors.bgAlt,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.xxs,
      paddingBottom: Spacing.xs,
      position: 'relative',
    },
    indicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: 3,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
      color: colors.textFaint,
    },
    labelActive: {
      color: colors.primary,
      fontWeight: FontWeight.semibold,
    },
  });
}
