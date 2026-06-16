// F053: a full-screen celebration shown once when a NEW user_milestones row
// appears (a lifetime threshold is crossed). Mirrors RatingCelebrationSheet's
// Modal + ShareCard, with a CheckinSuccessSheet-style particle burst. When it
// fires alongside the check-in success sheet, the caller STACKS it (shows this
// after the success sheet dismisses).
import React, { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { Lucide } from './Icon';
import { ShareCard } from './ShareCard';
import { shareCardImage } from '../lib/shareImage';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../hooks/useI18n';
import { hapticSuccess } from '../lib/haptics';
import { Springs, Duration } from '../lib/motion';
import type { ThemeColors } from '../theme';
import { Fonts, FontSize, FontWeight, Radius, Spacing } from '../theme';
import { MILESTONE_DEF_BY_KEY } from '../features/milestones';

/* ── Tiny particle burst (mirrors CheckinSuccessSheet, no deps) ── */
const PARTICLE_COUNT = 10;
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
        <ParticleDot key={i} angle={p.angle} color={p.color} visible={visible} />
      ))}
    </>
  );
}

function ParticleDot({ angle, color, visible }: { angle: number; color: string; visible: boolean }) {
  const scale = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      const radius = 60 + Math.random() * 24;
      const targetX = Math.cos(angle) * radius;
      const targetY = Math.sin(angle) * radius;
      scale.value = 0;
      translateX.value = 0;
      translateY.value = 0;
      opacity.value = 0;
      scale.value = withDelay(200, withSequence(
        withSpring(1, Springs.celebration),
        withDelay(300, withTiming(0, { duration: Duration.fast })),
      ));
      translateX.value = withDelay(200, withSpring(targetX, Springs.bouncy));
      translateY.value = withDelay(200, withSpring(targetY, Springs.bouncy));
      opacity.value = withDelay(200, withSequence(
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

interface Props {
  visible: boolean;
  /** The just-crossed milestone key (matches MILESTONE_DEF_BY_KEY). */
  milestoneKey: string | null;
  onClose: () => void;
}

export function MilestoneCelebrationSheet({ visible, milestoneKey, onClose }: Props) {
  const { colors } = useTheme();
  const { s } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (visible) hapticSuccess();
  }, [visible]);

  if (!visible || !milestoneKey) return null;
  const def = MILESTONE_DEF_BY_KEY[milestoneKey];
  if (!def) return null;

  const title = s(def.titleKey);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.wrap} onPress={() => {}} testID="milestone-celebration">
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <CelebrationBurst visible={visible} />
            <ShareCard
              ref={cardRef}
              icon={def.icon}
              headline={title}
              title={s('milestoneCelebrationTitle')}
              subtitle={s('milestoneCelebrationSubtitle')}
            />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => shareCardImage(cardRef, s('milestoneShareMessage', title))}
              accessibilityRole="button"
              testID="milestone-share"
            >
              <Lucide name="share-2" size={16} color={colors.textOnPrimary} />
              <Text style={styles.shareText}>{s('milestoneShare')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              testID="milestone-close"
            >
              <Text style={styles.closeText}>{s('close')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    wrap: { alignItems: 'center', gap: Spacing.md },
    actions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 22,
    },
    shareText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textOnPrimary },
    closeBtn: { borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 22, borderWidth: 1, borderColor: colors.border },
    closeText: { fontFamily: Fonts.body, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textMuted },
  });
}
