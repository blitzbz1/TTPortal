import React, { useEffect, useRef, useCallback } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Lucide } from './Icon';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../hooks/useTheme';
import { Fonts, FontWeight, Spacing } from '../theme';
import { NotificationInboxModal, type NotificationInboxModalRef } from './NotificationInboxModal';

const PULSE_DURATION = 2000;
const PULSE_HALF = PULSE_DURATION / 2;
const PULSE_SCALE = 1.2;

function usePulseAnimation(hasUnread: boolean) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (hasUnread) {
      scale.value = withRepeat(
        withSequence(
          withTiming(PULSE_SCALE, { duration: PULSE_HALF, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: PULSE_HALF, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    } else {
      scale.value = withTiming(1, { duration: PULSE_HALF });
    }
  }, [hasUnread, scale]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}

interface NotificationBellButtonProps {
  color: string;
}

export function NotificationBellButton({ color }: NotificationBellButtonProps) {
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();
  const pulseStyle = usePulseAnimation(unreadCount > 0);
  const modalRef = useRef<NotificationInboxModalRef>(null);

  const handlePress = useCallback(() => {
    modalRef.current?.present();
  }, []);

  return (
    <>
      <TouchableOpacity
        style={styles.bellBtn}
        onPress={handlePress}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Lucide name="bell" size={18} color={color} />
        {unreadCount > 0 && (
          <Animated.View style={[styles.bellBadge, { backgroundColor: colors.red }, pulseStyle]}>
            <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>
      <NotificationInboxModal ref={modalRef} />
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    position: 'relative',
    padding: Spacing.xxs,
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
});
