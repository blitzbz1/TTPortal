import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme';
import { Spacing, Radius } from '../theme';

/* ── Base shimmer block ── */
interface SkeletonBoxProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBox({ width, height, borderRadius = Radius.sm, style }: SkeletonBoxProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.bgMid, opacity },
        style,
      ]}
      testID="skeleton-box"
    />
  );
}

/* ── Layout-specific skeletons ── */

export function VenueCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.venueCard} testID="venue-card-skeleton">
      <View style={styles.venueCardInner}>
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="70%" height={14} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SkeletonBox width={60} height={12} />
            <SkeletonBox width={40} height={12} />
            <SkeletonBox width={50} height={12} />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <SkeletonBox width={50} height={20} borderRadius={4} />
          <SkeletonBox width={30} height={12} />
        </View>
      </View>
    </View>
  );
}

export function EventCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.eventCard} testID="event-card-skeleton">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkeletonBox width="55%" height={14} />
        <SkeletonBox width={60} height={22} borderRadius={Radius.md} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <SkeletonBox width={14} height={14} borderRadius={7} />
        <SkeletonBox width="60%" height={13} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <SkeletonBox width={28} height={28} borderRadius={14} />
          <SkeletonBox width={28} height={28} borderRadius={14} />
          <SkeletonBox width={28} height={28} borderRadius={14} />
        </View>
        <SkeletonBox width={70} height={32} borderRadius={Radius.md} />
      </View>
    </View>
  );
}

export function ReviewCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.reviewCard} testID="review-card-skeleton">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkeletonBox width={100} height={13} />
        <SkeletonBox width={60} height={12} />
      </View>
      <SkeletonBox width="90%" height={13} style={{ marginTop: 8 }} />
      <SkeletonBox width="60%" height={13} style={{ marginTop: 4 }} />
      <SkeletonBox width={70} height={11} style={{ marginTop: 8 }} />
    </View>
  );
}

export function FriendCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.friendCard} testID="friend-card-skeleton">
      <SkeletonBox width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox width="50%" height={14} />
        <SkeletonBox width="30%" height={12} />
      </View>
    </View>
  );
}

export function LeaderboardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View testID="leaderboard-skeleton">
      {/* Podium */}
      <View style={styles.podium}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={52} height={52} borderRadius={26} />
          <SkeletonBox width={60} height={12} />
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={64} height={64} borderRadius={32} />
          <SkeletonBox width={70} height={14} />
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={52} height={52} borderRadius={26} />
          <SkeletonBox width={60} height={12} />
        </View>
      </View>
      {/* Rank rows */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.rankRow}>
          <SkeletonBox width={20} height={14} />
          <SkeletonBox width={36} height={36} borderRadius={18} />
          <View style={{ flex: 1, gap: 4 }}>
            <SkeletonBox width="50%" height={14} />
            <SkeletonBox width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function NotificationSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.notifCard} testID="notification-skeleton">
      <SkeletonBox width={40} height={40} borderRadius={Radius.md} />
      <View style={{ flex: 1, gap: 4 }}>
        <SkeletonBox width="70%" height={13} />
        <SkeletonBox width="90%" height={12} />
        <SkeletonBox width={30} height={11} />
      </View>
    </View>
  );
}

export function FavoriteCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.favCard} testID="favorite-card-skeleton">
      <SkeletonBox width={48} height={48} borderRadius={12} />
      <View style={{ flex: 1, gap: 5 }}>
        <SkeletonBox width="60%" height={15} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <SkeletonBox width={50} height={16} borderRadius={6} />
          <SkeletonBox width={40} height={12} />
        </View>
        <SkeletonBox width="40%" height={11} />
      </View>
      <SkeletonBox width={22} height={22} borderRadius={11} />
    </View>
  );
}

export function ProfileSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View testID="profile-skeleton">
      <View style={styles.profileHero}>
        <SkeletonBox width={88} height={88} borderRadius={44} />
        <SkeletonBox width={150} height={22} style={{ marginTop: 16 }} />
        <SkeletonBox width={100} height={14} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.statsRow}>
        <SkeletonBox width="48%" height={70} borderRadius={14} />
        <SkeletonBox width="48%" height={70} borderRadius={14} />
      </View>
    </View>
  );
}

/* ── Skeleton list helper ── */
interface SkeletonListProps {
  count?: number;
  children: React.ReactNode;
}

export function SkeletonList({ count = 3, children }: SkeletonListProps) {
  return (
    <View testID="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>{children}</View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    venueCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      marginBottom: 6,
      padding: 10,
    },
    venueCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    eventCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: 14,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    reviewCard: {
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    friendCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: 14,
      padding: Spacing.sm,
      marginBottom: Spacing.xs,
      gap: Spacing.sm,
    },
    podium: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.md,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      gap: Spacing.sm,
    },
    notifCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: Radius.md,
      padding: 14,
      marginHorizontal: Spacing.sm,
      marginTop: Spacing.xs,
      gap: Spacing.sm,
    },
    favCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgAlt,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      gap: Spacing.sm,
    },
    profileHero: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: Spacing.xl,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      justifyContent: 'space-between',
    },
  });
}
