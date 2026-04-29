import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Share } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  FadeInUp,
} from 'react-native-reanimated';
import { Lucide } from './Icon';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Spacing, Radius, Shadows } from '../theme';
import { useI18n } from '../hooks/useI18n';
import { hapticSuccess } from '../lib/haptics';
import { Springs, Duration, Easings } from '../lib/motion';

/* ── Tiny particle burst (confetti-lite, no deps) ── */
const PARTICLE_COUNT = 8;
const PARTICLE_COLORS = ['#34C759', '#FFD60A', '#FF9F0A', '#30D158', '#64D2FF', '#BF5AF2'];

function CelebrationBurst({ visible }: { visible: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * 2 * Math.PI;
        return { angle, color: PARTICLE_COLORS[i % PARTICLE_COLORS.length] };
      }),
    [],
  );

  return (
    <>
      {particles.map((p, i) => (
        <ParticleDot key={i} angle={p.angle} color={p.color} visible={visible} index={i} />
      ))}
    </>
  );
}

function ParticleDot({ angle, color, visible, index }: { angle: number; color: string; visible: boolean; index: number }) {
  const scale = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      const radius = 50 + Math.random() * 20;
      const targetX = Math.cos(angle) * radius;
      const targetY = Math.sin(angle) * radius;

      scale.value = 0;
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 0;

      // Delay particles until after checkmark springs in (~400ms)
      scale.value = withDelay(400, withSequence(
        withSpring(1, Springs.celebration),
        withDelay(300, withTiming(0, { duration: Duration.fast })),
      ));
      translateX.value = withDelay(400, withSpring(targetX, Springs.bouncy));
      translateY.value = withDelay(400, withSpring(targetY, Springs.bouncy));
      opacity.value = withDelay(400, withSequence(
        withTiming(1, { duration: Duration.instant }),
        withDelay(500, withTiming(0, { duration: Duration.base })),
      ));
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible, angle, scale, translateX, translateY, opacity]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color,
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return <Animated.View style={style} />;
}

/* ── Main component ── */

interface CheckinSuccessSheetProps {
  visible: boolean;
  venueName: string;
  endTime?: string;
  onDismiss: () => void;
}

export function CheckinSuccessSheet({
  visible,
  venueName,
  endTime,
  onDismiss,
}: CheckinSuccessSheetProps) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      hapticSuccess();
      checkScale.value = 0;
      checkScale.value = withSpring(1, Springs.celebration);
    }
  }, [visible, checkScale]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Animated checkmark with particle burst */}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <CelebrationBurst visible={visible} />
            <Animated.View style={[styles.checkCircle, checkStyle]}>
              <Lucide name="check" size={36} color={colors.textOnPrimary} />
            </Animated.View>
          </View>

          <Text style={styles.title}>{s('checkinSuccess')}</Text>
          <Text style={styles.venue}>{venueName}</Text>

          {endTime && (
            <View style={styles.timeRow}>
              <Lucide name="clock" size={14} color={colors.textFaint} />
              <Text style={styles.timeText}>{s('untilTime')} {endTime}</Text>
            </View>
          )}

          {/* XP animation — slides up after checkmark */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(400).easing(Easings.decelerate)}
            style={styles.xpRow}
          >
            <Text style={styles.xpText}>+10 XP</Text>
          </Animated.View>

          <TouchableOpacity style={styles.shareBtn} onPress={() => {
            Share.share({ message: `${s('checkinSuccess')} ${venueName} | TT Portal` });
          }} testID="checkin-success-share">
            <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
            <Text style={styles.shareBtnText}>{s('shareCard')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} testID="checkin-success-dismiss">
            <Text style={styles.dismissText}>{s('close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayHeavy,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheet: {
      backgroundColor: colors.bgAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xxl,
      width: '100%',
      maxWidth: 430,
      alignItems: 'center',
      ...Shadows.lg,
    },
    handleWrap: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    checkCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
      ...Shadows.md,
    },
    title: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    venue: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      color: colors.textMuted,
      marginTop: 4,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.xs,
    },
    timeText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: colors.textFaint,
    },
    xpRow: {
      marginTop: Spacing.md,
      backgroundColor: colors.primaryPale,
      borderRadius: Radius.md,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.primaryDim,
    },
    xpText: {
      fontFamily: Fonts.heading,
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.primaryLight,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.xs,
      marginTop: Spacing.lg,
      ...Shadows.md,
    },
    shareBtnText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textOnPrimary,
    },
    dismissBtn: {
      marginTop: Spacing.sm,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      paddingHorizontal: 48,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dismissText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.textMuted,
    },
  });
}
