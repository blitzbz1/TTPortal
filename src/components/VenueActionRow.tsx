import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { hapticLight } from '../lib/haptics';

interface VenueActionRowProps {
  favorited: boolean;
  checkedIn: boolean;
  checkinLoading: boolean;
  onCheckin: () => void;
  onReview: () => void;
  onFavorite: () => void;
  onShare: () => void;
}

export function VenueActionRow({
  favorited,
  checkedIn,
  checkinLoading,
  onCheckin,
  onReview,
  onFavorite,
  onShare,
}: VenueActionRowProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const favScale = useRef(new Animated.Value(1)).current;

  const animateFavorite = () => {
    Animated.sequence([
      Animated.timing(favScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(favScale, { toValue: 1.0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const actions = [
    {
      key: 'checkin',
      icon: checkedIn ? 'check-circle' : 'map-pin',
      label: checkedIn ? s('checkout') : s('checkinHere'),
      onPress: onCheckin,
      active: checkedIn,
      loading: checkinLoading,
      activeColor: colors.primaryLight,
    },
    {
      key: 'review',
      icon: 'pen-line',
      label: s('writeBtn'),
      onPress: onReview,
      active: false,
      loading: false,
      activeColor: colors.primary,
    },
    {
      key: 'favorite',
      icon: 'heart',
      label: favorited ? s('favRemove') : s('favAdd'),
      onPress: () => { hapticLight(); animateFavorite(); onFavorite(); },
      active: favorited,
      loading: false,
      activeColor: colors.red,
    },
    {
      key: 'share',
      icon: 'share-2',
      label: s('navigation'),
      onPress: onShare,
      active: false,
      loading: false,
      activeColor: colors.primary,
    },
  ];

  return (
    <View style={styles.container} testID="venue-action-row">
      {actions.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={styles.action}
          onPress={action.onPress}
          disabled={action.loading}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          testID={`action-${action.key}`}
          accessibilityLabel={action.label}
          accessibilityRole="button"
        >
          {action.loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Animated.View style={action.key === 'favorite' ? { transform: [{ scale: favScale }] } : undefined}>
              <View style={[styles.iconCircle, action.active && { backgroundColor: action.activeColor + '18' }]}>
                <Lucide
                  name={action.icon}
                  size={20}
                  color={action.active ? action.activeColor : colors.textMuted}
                />
              </View>
            </Animated.View>
          )}
          <Text
            style={[styles.label, action.active && { color: action.activeColor, fontWeight: '600' }]}
            numberOfLines={1}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.bgAlt,
      paddingVertical: 10,
      paddingHorizontal: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      ...Shadows.sm,
    },
    action: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.xxs,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgMuted,
    },
    label: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
