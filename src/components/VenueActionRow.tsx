import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { hapticLight } from '../lib/haptics';
import { Springs } from '../lib/motion';

interface VenueActionRowProps {
  favorited: boolean;
  checkedIn: boolean;
  checkinLoading: boolean;
  onCheckin: () => void;
  onReview: () => void;
  onFavorite: () => void;
  onShare: () => void;
}

function VenueActionRowImpl({
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

  const favScale = useSharedValue(1);

  const favAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favScale.value }],
  }));

  const animateFavorite = React.useCallback(() => {
    favScale.value = withSpring(1.4, Springs.bouncy, () => {
      favScale.value = withSpring(1, Springs.gentle);
    });
  }, [favScale]);

  const onFavoritePress = React.useCallback(() => {
    hapticLight();
    animateFavorite();
    onFavorite();
  }, [animateFavorite, onFavorite]);

  const actions = useMemo(() => [
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
      onPress: onFavoritePress,
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
  ], [
    favorited,
    checkedIn,
    checkinLoading,
    onCheckin,
    onReview,
    onFavoritePress,
    onShare,
    colors.primaryLight,
    colors.primary,
    colors.red,
    s,
  ]);

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
            <ReanimatedAnimated.View style={action.key === 'favorite' ? favAnimStyle : undefined}>
              <View style={[styles.iconCircle, action.active && { backgroundColor: action.activeColor + '18' }]}>
                <Lucide
                  name={action.icon}
                  size={20}
                  color={action.active ? action.activeColor : colors.textMuted}
                />
              </View>
            </ReanimatedAnimated.View>
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

export const VenueActionRow = React.memo(VenueActionRowImpl);

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
